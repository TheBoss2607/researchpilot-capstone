
import json
import re
import time
import logging
from pathlib import Path
from urllib.parse import urljoin, urlparse, parse_qs

import requests
from bs4 import BeautifulSoup, Tag
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# ============================================================
# CONFIGURATION
# ============================================================

BASE_URL = "https://staff.pes.edu"
DIRECTORY_URL = f"{BASE_URL}/atoz/?campus=ec&letter=ALL"

OUTPUT_DIR = Path(__file__).resolve().parent
RAW_HTML_DIR = OUTPUT_DIR / "raw_html"

FACULTY_FILE = OUTPUT_DIR / "faculty_raw.json"
URLS_FILE = OUTPUT_DIR / "profile_urls.json"
FAILED_FILE = OUTPUT_DIR / "failed_profiles.json"
LOG_FILE = OUTPUT_DIR / "scraper.log"

REQUEST_DELAY_SECONDS = 1.0
REQUEST_TIMEOUT_SECONDS = 30

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
RAW_HTML_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)

logger = logging.getLogger("pes_faculty_scraper")


# ============================================================
# HTTP SESSION
# ============================================================

session = requests.Session()

session.headers.update({
    "User-Agent": (
        "RESEARCHPILOT academic research project "
        "(polite public-page data collection)"
    )
})

retry_strategy = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"],
)

adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("https://", adapter)
session.mount("http://", adapter)


# ============================================================
# GENERAL HELPERS
# ============================================================

def normalize_space(value):
    if value is None:
        return None

    value = re.sub(r"\s+", " ", str(value)).strip()
    return value or None


def element_text(element):
    if element is None:
        return None

    return normalize_space(element.get_text(" ", strip=True))


def clean_text(value):
    value = normalize_space(value) or ""
    value = re.sub(r"\bsvg\b", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value)
    return value.strip(" \t\r\n|·,:-")


def save_json(path, data):
    """Save JSON atomically."""
    temporary_path = path.with_suffix(path.suffix + ".tmp")

    temporary_path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    temporary_path.replace(path)


def fetch_soup(url):
    response = session.get(
        url,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()

    if (
        not response.encoding
        or response.encoding.lower() == "iso-8859-1"
    ):
        response.encoding = response.apparent_encoding

    return (
        BeautifulSoup(response.text, "html.parser"),
        response.url,
        response.text,
    )


def canonical_profile_url(url):
    parsed = urlparse(url)

    if parsed.netloc.lower() not in {
        "staff.pes.edu",
        "www.staff.pes.edu",
    }:
        return None

    match = re.fullmatch(r"/(nm\d+)/?", parsed.path)

    if not match:
        return None

    return f"{BASE_URL}/{match.group(1)}/"


def save_page_html(profile_id, html):
    path = RAW_HTML_DIR / f"{profile_id}.html"
    path.write_text(html, encoding="utf-8")


# ============================================================
# DEPARTMENT CANONICALIZATION
# ============================================================

# Each canonical name maps to the variations that may appear on PES.
# Longer/specific department names are checked before shorter names.
DEPARTMENT_ALIASES = {
    "Computer Science (AIML)": [
        "Computer Science (AIML)",
        "Computer Science AIML",
        "Computer Science (AI & ML)",
        "Computer Science (AI and ML)",
        "Computer Science (Artificial Intelligence and Machine Learning)",
        "Computer Science Artificial Intelligence and Machine Learning",
        "Computer Science and Artificial Intelligence and Machine Learning",
    ],
    "Computer Science": [
        "Computer Science and Engineering",
        "Computer Science & Engineering",
        "Computer Science",
        "Computer Sciences",
        "CSE",
    ],
    "Computer Application": [
        "Computer Applications",
        "Computer Application",
        "MCA",
    ],
    "Electronics and Communication": [
        "Electronics and Communication Engineering",
        "Electronics & Communication Engineering",
        "Electronics and Communication",
        "Electronics & Communication",
    ],
    "Electrical and Electronics": [
        "Electrical and Electronics Engineering",
        "Electrical & Electronics Engineering",
        "Electronics and Electrical Engineering",
        "Electronics & Electrical Engineering",
        "Electrical and Electronics",
        "Electrical & Electronics",
    ],
    "Pharmaceutical Sciences": [
        "Pharmaceutical Sciences",
        "Pharmaceutical Science",
    ],
    "Centre for Innovation and Entrepreneurship": [
        "Centre for Innovation and Entrepreneurship",
        "Center for Innovation and Entrepreneurship",
        "Innovation and Entrepreneurship",
    ],
    "Science and Humanities": [
        "Science and Humanities",
        "Science & Humanities",
    ],
    "Management Studies": [
        "Management Studies",
        "Management Study",
    ],
    "Biotechnology": [
        "Biotechnology",
        "Biotech",
    ],
    "Architecture": [
        "Architecture",
    ],
    "Civil": [
        "Civil Engineering",
        "Civil",
    ],
    "Design": [
        "Design",
    ],
    "Law": [
        "Law",
    ],
    "Mechanical": [
        "Mechanical Engineering",
        "Mechanical",
    ],
    "Commerce": [
        "Commerce",
    ],
    "Psychology": [
        "Psychology",
    ],
}


def alias_to_pattern(alias):
    """
    Convert an alias to a regex with flexible whitespace and separators.
    Escaping prevents punctuation in department names becoming regex syntax.
    """
    parts = re.split(r"[\s]+", alias.strip())
    return r"[\s\-–]*".join(re.escape(part) for part in parts)


# Build alias patterns, putting longer aliases first.
DEPARTMENT_PATTERNS = []

for canonical_name, aliases in DEPARTMENT_ALIASES.items():
    for alias in aliases:
        DEPARTMENT_PATTERNS.append(
            (
                canonical_name,
                alias,
                re.compile(
                    rf"(?<!\w){alias_to_pattern(alias)}(?!\w)",
                    re.IGNORECASE,
                ),
            )
        )

DEPARTMENT_PATTERNS.sort(
    key=lambda item: len(item[1]),
    reverse=True,
)


def canonicalize_department(value):
    """
    Return a canonical department only when a known department name
    can be found as a distinct phrase in the supplied value.
    """
    if not value:
        return None

    text = clean_text(value)

    for canonical_name, alias, pattern in DEPARTMENT_PATTERNS:
        if pattern.search(text):
            return canonical_name

    return None


def all_department_matches(value):
    """Find every recognized department in a piece of text."""
    if not value:
        return []

    text = clean_text(value)
    matches = []

    for canonical_name, alias, pattern in DEPARTMENT_PATTERNS:
        for match in pattern.finditer(text):
            matches.append({
                "canonical": canonical_name,
                "alias": alias,
                "start": match.start(),
                "end": match.end(),
            })

    # Remove duplicate matches that overlap the same phrase.
    matches.sort(
        key=lambda item: (
            item["start"],
            -(item["end"] - item["start"]),
        )
    )

    selected = []

    for candidate in matches:
        overlaps = any(
            candidate["start"] < existing["end"]
            and candidate["end"] > existing["start"]
            for existing in selected
        )

        if not overlaps:
            selected.append(candidate)

    return selected


# ============================================================
# CAMPUS / CONTACT IDENTIFICATION
# ============================================================

CAMPUS_PATTERN = re.compile(
    r"\b(?:EC|RR|HN)\s+Campus\b",
    re.IGNORECASE,
)

EMAIL_PATTERN = re.compile(
    r"\b[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}\b"
)

PHONE_PATTERN = re.compile(
    r"(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)"
)


def remove_contact_details(text):
    text = EMAIL_PATTERN.sub(" ", text)
    text = PHONE_PATTERN.sub(" ", text)
    text = CAMPUS_PATTERN.sub(" ", text)
    text = re.sub(r"\bsvg\b", " ", text, flags=re.IGNORECASE)
    return clean_text(text)


# ============================================================
# DEPARTMENT SOURCE 1: PROFILE HEADER
# ============================================================

def extract_header_department(soup, name):
    """
    Find the department in the short header fragment between the name
    and the campus marker. Do not scan a large page/container and take
    an arbitrary department match.
    """
    campus_nodes = soup.find_all(
        string=re.compile(
            r"\b(?:EC|RR|HN)\s+Campus\b",
            re.IGNORECASE,
        )
    )

    for campus_node in campus_nodes:
        for ancestor in campus_node.parents:
            if not isinstance(ancestor, Tag):
                continue

            if ancestor.name in {"html", "body"}:
                break

            text = clean_text(ancestor.get_text(" ", strip=True))

            # Only inspect reasonably small header-like containers.
            if not text or len(text) > 450:
                continue

            campus_match = CAMPUS_PATTERN.search(text)

            if not campus_match:
                continue

            prefix = text[:campus_match.start()]

            # If the faculty name is present, start immediately after it.
            if name and name.casefold() in prefix.casefold():
                name_end = (
                    prefix.casefold().rfind(name.casefold())
                    + len(name)
                )
                fragment = prefix[name_end:]
            else:
                # The metadata is usually immediately before Campus.
                fragment = prefix[-180:]

            fragment = remove_contact_details(fragment)
            matches = all_department_matches(fragment)

            # Header should contain one department. Multiple different
            # department matches make this source ambiguous.
            unique_departments = list(dict.fromkeys(
                item["canonical"] for item in matches
            ))

            if len(unique_departments) == 1:
                return unique_departments[0]

            if len(unique_departments) > 1:
                logger.warning(
                    "Ambiguous header departments for %s: %s",
                    name,
                    unique_departments,
                )

    return None


# ============================================================
# DEPARTMENT SOURCE 2: ABOUT SECTION
# ============================================================

def find_about_heading(soup):
    """Find an About heading, if the profile uses one."""
    for heading in soup.find_all(
        ["h1", "h2", "h3", "h4", "h5", "h6"]
    ):
        text = clean_text(element_text(heading) or "")

        if re.fullmatch(r"about(?:\s+me|\s+profile)?", text, re.I):
            return heading

    return None


def extract_about_department(soup):
    """
    Read a department value from a labeled field inside the About section.

    Prefer:
      * table row: Department | Computer Science
      * definition list: Department | Computer Science
      * explicit label/value pairs

    Avoid searching the whole page for a department name because unrelated
    publication text and other faculty listings may contain department names.
    """
    about_heading = find_about_heading(soup)

    if about_heading is None:
        # Some layouts do not label the section as About.
        # Search only exact, explicit Department label/value structures.
        search_roots = [soup]
    else:
        # Identify the nearest containing section and inspect only it.
        section = about_heading.find_parent(
            ["section", "article"]
        )

        if section is not None:
            search_roots = [section]
        else:
            parent = about_heading.parent
            search_roots = [parent] if parent else [soup]

    for root in search_roots:
        # Tables: Department | value
        for row in root.find_all("tr"):
            cells = row.find_all(
                ["th", "td"],
                recursive=False,
            )

            if len(cells) < 2:
                continue

            label = clean_text(element_text(cells[0]) or "")

            if re.fullmatch(
                r"(?:department|department name|dept)",
                label,
                re.IGNORECASE,
            ):
                value = clean_text(element_text(cells[1]) or "")
                department = canonicalize_department(value)

                if department:
                    return department

        # Definition lists: <dt>Department</dt><dd>Computer Science</dd>
        for label_node in root.find_all(["dt", "th", "label", "strong", "b"]):
            label = clean_text(element_text(label_node) or "")

            if not re.fullmatch(
                r"(?:department|department name|dept)",
                label,
                re.IGNORECASE,
            ):
                continue

            sibling = label_node.find_next_sibling(
                ["dd", "td", "span", "p", "div"]
            )

            if sibling:
                value = clean_text(element_text(sibling) or "")
                department = canonicalize_department(value)

                if department:
                    return department

            # Support layouts like <strong>Department:</strong> Computer Science
            parent_text = clean_text(
                element_text(label_node.parent) or ""
            )

            match = re.match(
                r"^\s*(?:department|department name|dept)\s*:?\s*(.+?)\s*$",
                parent_text,
                re.IGNORECASE,
            )

            if match:
                department = canonicalize_department(match.group(1))

                if department:
                    return department

        # Inspect short text elements for explicit Department: value.
        for element in root.find_all(
            ["p", "div", "li", "span", "td", "dd"]
        ):
            text = clean_text(element_text(element) or "")

            if not text or len(text) > 220:
                continue

            # Require the department label to begin the element.
            match = re.match(
                r"^\s*(?:department|department name|dept)\s*:?\s*(.+?)\s*$",
                text,
                re.IGNORECASE,
            )

            if match:
                value = match.group(1)

                # Remove other metadata if multiple fields share one element.
                value = re.split(
                    r"\s+(?:campus|designation|email|phone|telephone)\b",
                    value,
                    maxsplit=1,
                    flags=re.IGNORECASE,
                )[0]

                department = canonicalize_department(value)

                if department:
                    return department

    return None


# ============================================================
# FINAL DEPARTMENT RESOLUTION
# ============================================================

def extract_department(soup, name):
    """
    Compare the independent header and About-section results.

    Agreement: accept.
    Only one source succeeds: use it.
    Conflict: prefer explicit About field and log the disagreement.
    Neither succeeds: return None instead of guessing.
    """
    header_department = extract_header_department(soup, name)
    about_department = extract_about_department(soup)

    if (
        header_department
        and about_department
        and header_department == about_department
    ):
        return header_department

    if header_department and about_department:
        logger.warning(
            "Department mismatch for %s: header=%s, about=%s. "
            "Using the explicit About-section value.",
            name,
            header_department,
            about_department,
        )
        return about_department

    if about_department:
        return about_department

    if header_department:
        return header_department

    logger.warning(
        "Could not reliably identify department for %s",
        name,
    )

    return None


# ============================================================
# DIRECTORY DISCOVERY AND PAGINATION
# ============================================================

def is_ec_directory_url(url):
    parsed = urlparse(url)

    if parsed.netloc.lower() not in {
        "staff.pes.edu",
        "www.staff.pes.edu",
    }:
        return False

    if parsed.path.rstrip("/") != "/atoz":
        return False

    params = parse_qs(parsed.query)

    return params.get("campus", [""])[0].lower() == "ec"


def get_directory_pages():
    """Discover faculty profile URLs throughout the EC directory."""
    queue = [DIRECTORY_URL]
    visited = set()
    profile_urls = set()

    while queue:
        page_url = queue.pop(0)

        if page_url in visited:
            continue

        visited.add(page_url)
        logger.info("Reading directory: %s", page_url)

        try:
            soup, final_url, _ = fetch_soup(page_url)
        except requests.RequestException as exc:
            logger.error(
                "Directory request failed: %s (%s)",
                page_url,
                exc,
            )
            continue

        if not is_ec_directory_url(final_url):
            logger.warning(
                "Unexpected directory redirect; skipping: %s",
                final_url,
            )
            continue

        for link in soup.find_all("a", href=True):
            absolute_url = urljoin(final_url, link["href"])
            profile_url = canonical_profile_url(absolute_url)

            if profile_url:
                profile_urls.add(profile_url)

        for link in soup.find_all("a", href=True):
            absolute_url = urljoin(final_url, link["href"])

            if (
                is_ec_directory_url(absolute_url)
                and absolute_url not in visited
                and absolute_url not in queue
            ):
                queue.append(absolute_url)

        for link in soup.find_all("link", rel=True, href=True):
            if "next" not in link.get("rel", []):
                continue

            absolute_url = urljoin(final_url, link["href"])

            if (
                is_ec_directory_url(absolute_url)
                and absolute_url not in visited
                and absolute_url not in queue
            ):
                queue.append(absolute_url)

        time.sleep(REQUEST_DELAY_SECONDS)

    return sorted(profile_urls)


# ============================================================
# SECTION EXTRACTION: RESEARCH AREAS AND PUBLICATIONS
# ============================================================

HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}


def heading_matches(text, patterns):
    if not text:
        return False

    return any(
        re.search(pattern, text, flags=re.IGNORECASE)
        for pattern in patterns
    )


def find_section_heading(soup, patterns):
    for pattern in patterns:
        for heading in soup.find_all(list(HEADING_TAGS)):
            text = element_text(heading)

            if text and re.search(
                pattern,
                text,
                flags=re.IGNORECASE,
            ):
                return heading

    return None


def extract_section_items(soup, patterns, stop_patterns=None):
    heading = find_section_heading(soup, patterns)

    if heading is None:
        return []

    heading_level = int(heading.name[1])
    results = []
    seen = set()
    stop_patterns = stop_patterns or []

    for element in heading.next_elements:
        if getattr(element, "name", None) in HEADING_TAGS:
            heading_text = element_text(element)
            heading_level_next = int(element.name[1])

            if heading_matches(heading_text, stop_patterns):
                break

            if heading_level_next <= heading_level:
                break

            continue

        if getattr(element, "name", None) not in {"li", "p"}:
            continue

        if element.find(["p", "li"]):
            continue

        text = element_text(element)

        if not text or len(text) > 1000:
            continue

        if len(text) <= 2 and text.isdigit():
            continue

        key = text.casefold()

        if key not in seen:
            seen.add(key)
            results.append(text)

    return results


def extract_research_areas(soup):
    areas = extract_section_items(
        soup,
        patterns=[
            r"^\s*research\s*interests?\s*$",
            r"^\s*areas?\s+of\s+research\s*$",
            r"^\s*research\s*areas?\s*$",
        ],
        stop_patterns=[r"research\s*projects?"],
    )

    excluded = {
        "research areas",
        "research area",
        "research interest",
        "research interests",
        "research projects",
        "publications",
    }

    return [
        item for item in areas
        if item.casefold().strip(" :") not in excluded
    ]


def extract_publications(soup):
    publications = extract_section_items(
        soup,
        patterns=[
            r"^\s*publications?\s*$",
            r"^\s*selected\s+publications?\s*$",
            r"^\s*research\s+publications?\s*$",
        ],
    )

    excluded = {
        "publications",
        "publication",
        "conferences",
        "conference",
        "journals",
        "journal",
        "others",
    }

    return [
        item for item in publications
        if item.casefold().strip(" :") not in excluded
    ]


# ============================================================
# OTHER PROFILE METADATA
# ============================================================

def extract_labeled_value(soup, labels):
    """Extract labeled values for fields other than department."""
    label_alt = "|".join(
        sorted(
            (re.escape(label) for label in labels),
            key=len,
            reverse=True,
        )
    )

    for row in soup.find_all("tr"):
        cells = row.find_all(["th", "td"], recursive=False)

        if len(cells) < 2:
            continue

        label = clean_text(element_text(cells[0]) or "")

        if any(
            re.fullmatch(
                rf"\s*{re.escape(item)}\s*:?\s*",
                label,
                re.IGNORECASE,
            )
            for item in labels
        ):
            value = element_text(cells[1])

            if value and len(value) <= 200:
                return value

    for tag in soup.find_all(["dt", "th", "strong", "b", "label"]):
        label = clean_text(element_text(tag) or "")

        if not any(
            re.fullmatch(
                rf"\s*{re.escape(item)}\s*:?\s*",
                label,
                re.IGNORECASE,
            )
            for item in labels
        ):
            continue

        sibling = tag.find_next_sibling(
            ["dd", "td", "span", "p", "div"]
        )

        if sibling:
            value = element_text(sibling)

            if value and len(value) <= 200:
                return value

    for element in soup.find_all(
        ["p", "li", "div", "td", "th", "dt", "dd", "span"]
    ):
        text = element_text(element)

        if not text or len(text) > 300:
            continue

        match = re.match(
            rf"^\s*(?:{label_alt})\b\s*:?\s*(.+?)\s*$",
            text,
            re.IGNORECASE,
        )

        if match:
            value = match.group(1).strip(" :·|,-")

            if value and len(value) <= 200:
                return value

    return None


def extract_name(soup):
    for heading in soup.find_all("h1"):
        name = element_text(heading)

        if name and len(name) <= 150:
            return name

    for meta in soup.find_all("meta"):
        if meta.get("property") == "og:title":
            value = normalize_space(meta.get("content"))

            if value:
                return value

    return None


def extract_photo_url(soup, profile_url, name):
    generic_markers = [
        "pesu-staff-dark.png",
        "logo",
        "favicon",
        "banner",
        "social",
    ]

    candidates = []

    for img in soup.find_all("img"):
        src = (
            img.get("src")
            or img.get("data-src")
            or img.get("data-original")
        )

        if not src:
            continue

        image_url = urljoin(profile_url, src)
        lower_url = image_url.casefold()

        if any(marker in lower_url for marker in generic_markers):
            continue

        if urlparse(image_url).scheme not in {"http", "https"}:
            continue

        description = (
            (normalize_space(img.get("alt")) or "")
            + " "
            + (normalize_space(img.get("title")) or "")
        ).casefold()

        score = 0

        if name and name.casefold() in description:
            score += 10

        if any(
            word in description
            for word in ("faculty", "profile", "staff")
        ):
            score += 5

        try:
            width = int(img.get("width", 0))
            height = int(img.get("height", 0))

            if width >= 80 and height >= 80:
                score += 2
        except (TypeError, ValueError):
            pass

        if score > 0:
            candidates.append((score, image_url))

    if not candidates:
        return None

    candidates.sort(key=lambda item: item[0], reverse=True)

    return candidates[0][1]


# ============================================================
# INDIVIDUAL FACULTY PROFILE
# ============================================================

def extract_profile(profile_url):
    soup, final_url, html = fetch_soup(profile_url)

    profile_url = canonical_profile_url(final_url) or profile_url
    faculty_id = urlparse(profile_url).path.strip("/")

    save_page_html(faculty_id, html)

    name = extract_name(soup)

    # Department now uses two independent, constrained sources.
    department = extract_department(soup, name)

    designation = extract_labeled_value(
        soup,
        ["Designation", "Position", "Job Title", "Title"],
    )

    campus = extract_labeled_value(
        soup,
        ["Campus", "Campus Name"],
    )

    if campus:
        if campus.strip().casefold() == "ec":
            campus = "EC Campus"
        elif campus.strip().casefold() == "rr":
            campus = "RR Campus"
        elif campus.strip().casefold() == "hn":
            campus = "HN Campus"

    if not campus:
        page_text = element_text(soup) or ""

        for code, label in [
            ("EC", "EC Campus"),
            ("RR", "RR Campus"),
            ("HN", "HN Campus"),
        ]:
            if re.search(
                rf"\b{code}\s+Campus\b",
                page_text,
                re.IGNORECASE,
            ):
                campus = label
                break

    return {
        "faculty_id": faculty_id,
        "name": name,
        "department": department,
        "campus": campus,
        "designation": designation,
        "profile_url": profile_url,
        "photo_url": extract_photo_url(soup, profile_url, name),
        "research_areas": extract_research_areas(soup),
        "publications_raw": extract_publications(soup),
        "data_source": "PES University Staff Directory",
        "last_scraped_utc": time.strftime(
            "%Y-%m-%dT%H:%M:%SZ",
            time.gmtime(),
        ),
        "verification_status": "needs_manual_validation",
    }


# ============================================================
# MAIN FULL-SCRAPE WORKFLOW
# ============================================================

def main():
    logger.info("=" * 60)
    logger.info("Starting FULL PES EC faculty scrape")
    logger.info("Output directory: %s", OUTPUT_DIR)
    logger.info("=" * 60)

    profile_urls = get_directory_pages()

    logger.info("Discovered %d unique faculty profile URLs.", len(profile_urls))

    if not profile_urls:
        logger.error(
            "No profiles discovered. Existing JSON files were not replaced."
        )
        return

    save_json(URLS_FILE, profile_urls)

    records = []
    failures = []

    for index, profile_url in enumerate(profile_urls, start=1):
        logger.info(
            "[%d/%d] Scraping %s",
            index,
            len(profile_urls),
            profile_url,
        )

        try:
            record = extract_profile(profile_url)
            records.append(record)

            logger.info(
                "Extracted: %s | department=%s | areas=%d | publications=%d",
                record["name"],
                record["department"],
                len(record["research_areas"]),
                len(record["publications_raw"]),
            )

            if not record["department"]:
                logger.warning(
                    "Department unresolved; review profile: %s",
                    profile_url,
                )

        except Exception as exc:
            logger.exception("Failed to scrape %s", profile_url)

            failures.append({
                "profile_url": profile_url,
                "error": str(exc),
            })

        if index % 10 == 0 or index == len(profile_urls):
            save_json(FACULTY_FILE, records)
            save_json(FAILED_FILE, failures)

            logger.info(
                "Progress saved: %d/%d; failures=%d",
                index,
                len(profile_urls),
                len(failures),
            )

        time.sleep(REQUEST_DELAY_SECONDS)

    save_json(FACULTY_FILE, records)
    save_json(FAILED_FILE, failures)

    department_counts = {}

    for record in records:
        department = record.get("department") or "(unresolved)"
        department_counts[department] = (
            department_counts.get(department, 0) + 1
        )

    logger.info("=" * 60)
    logger.info("FULL SCRAPE COMPLETE")
    logger.info("Discovered URLs: %d", len(profile_urls))
    logger.info("Profiles saved: %d", len(records))
    logger.info("Failed profiles: %d", len(failures))
    logger.info("Department counts:")

    for department, count in sorted(
        department_counts.items(),
        key=lambda item: (-item[1], item[0].casefold()),
    ):
        logger.info("  %s: %d", department, count)

    logger.info("Faculty JSON: %s", FACULTY_FILE)
    logger.info("Profile URLs: %s", URLS_FILE)
    logger.info("Failed profiles: %s", FAILED_FILE)
    logger.info("Raw HTML directory: %s", RAW_HTML_DIR)
    logger.info("Log file: %s", LOG_FILE)
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
