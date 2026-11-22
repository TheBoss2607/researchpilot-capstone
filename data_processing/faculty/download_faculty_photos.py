
import json
import re
import time
import logging
import mimetypes
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import url2pathname

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# ============================================================
# CONFIGURATION
# ============================================================

BASE_URL = "https://staff.pes.edu"

DATA_DIR = Path(__file__).resolve().parent
FACULTY_FILE = DATA_DIR / "faculty_raw.json"
PHOTO_DIR = DATA_DIR / "faculty_photos"
LOG_FILE = DATA_DIR / "photo_downloader.log"
FAILED_FILE = DATA_DIR / "failed_photos.json"

REQUEST_DELAY_SECONDS = 1.0
REQUEST_TIMEOUT_SECONDS = 30

PHOTO_DIR.mkdir(parents=True, exist_ok=True)


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

logger = logging.getLogger("pes_photo_downloader")


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
# JSON HELPERS
# ============================================================

def save_json(path, data):
    temporary_path = path.with_suffix(path.suffix + ".tmp")

    temporary_path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    temporary_path.replace(path)


def load_faculty():
    if not FACULTY_FILE.exists():
        raise FileNotFoundError(
            f"Faculty JSON not found: {FACULTY_FILE}"
        )

    with FACULTY_FILE.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, list):
        raise ValueError(
            "Expected faculty_raw.json to contain a JSON array."
        )

    return data


# ============================================================
# IMAGE VALIDATION
# ============================================================

IMAGE_SIGNATURES = {
    "jpg": (b"\xff\xd8\xff",),
    "png": (b"\x89PNG\r\n\x1a\n",),
    "gif": (b"GIF87a", b"GIF89a"),
    "webp": (b"RIFF",),
}


def detect_image_extension(content, content_type):
    """
    Validate common image formats using file signatures.
    Returns an extension or None.
    """

    content_type = (
        content_type.split(";")[0].strip().lower()
        if content_type else ""
    )

    if content.startswith(IMAGE_SIGNATURES["jpg"][0]):
        return "jpg"

    if content.startswith(IMAGE_SIGNATURES["png"][0]):
        return "png"

    if any(
        content.startswith(signature)
        for signature in IMAGE_SIGNATURES["gif"]
    ):
        return "gif"

    if (
        content.startswith(b"RIFF")
        and content[8:12] == b"WEBP"
    ):
        return "webp"

    # Do not accept arbitrary HTML or unknown binary responses.
    return None


def is_valid_image_file(path):
    if not path.exists() or path.stat().st_size < 100:
        return False

    try:
        with path.open("rb") as file:
            header = file.read(16)

        return detect_image_extension(header, None) is not None

    except OSError:
        return False


# ============================================================
# PROFILE IMAGE DISCOVERY
# ============================================================

GENERIC_IMAGE_MARKERS = (
    "logo",
    "favicon",
    "banner",
    "social",
    "pesu-staff-dark",
)


def is_possible_image_url(url):
    if not url:
        return False

    parsed = urlparse(url)

    if parsed.scheme not in {"http", "https"}:
        return False

    if parsed.netloc.lower() not in {
        "staff.pes.edu",
        "www.staff.pes.edu",
    }:
        return False

    if any(
        marker in url.casefold()
        for marker in GENERIC_IMAGE_MARKERS
    ):
        return False

    return True


def discover_profile_photo(soup, profile_url, faculty_name):
    """
    PES profile pages may expose a photograph as:
      1. A linked image, e.g. <a href="...jpg">Image: Faculty Name</a>
      2. An embedded <img> element.
      3. An image URL in data-src or data-original.

    Linked images with an explicit Image label are prioritised.
    """

    candidates = []

    # --------------------------------------------------------
    # Method 1: Linked profile photograph
    # --------------------------------------------------------

    for anchor in soup.find_all("a", href=True):
        image_url = urljoin(profile_url, anchor["href"])

        if not is_possible_image_url(image_url):
            continue

        label = " ".join([
            anchor.get_text(" ", strip=True),
            str(anchor.get("title", "")),
            str(anchor.get("aria-label", "")),
        ]).casefold()

        score = 0

        if re.search(r"\bimage\b", label):
            score += 20

        if (
            faculty_name
            and faculty_name.casefold() in label
        ):
            score += 10

        if "/media/staff/" in image_url.casefold():
            score += 5

        extension = Path(urlparse(image_url).path).suffix.lower()

        if extension in {
            ".jpg", ".jpeg", ".png", ".webp", ".gif"
        }:
            score += 5

        if score > 0:
            candidates.append((score, image_url))

    # --------------------------------------------------------
    # Method 2: Embedded images
    # --------------------------------------------------------

    for img in soup.find_all("img"):
        src = (
            img.get("src")
            or img.get("data-src")
            or img.get("data-original")
        )

        if not src:
            continue

        image_url = urljoin(profile_url, src)

        if not is_possible_image_url(image_url):
            continue

        description = " ".join([
            str(img.get("alt", "")),
            str(img.get("title", "")),
        ]).casefold()

        score = 0

        if (
            faculty_name
            and faculty_name.casefold() in description
        ):
            score += 10

        if any(
            word in description
            for word in ("faculty", "profile", "staff", "image")
        ):
            score += 5

        if "/media/staff/" in image_url.casefold():
            score += 5

        if score > 0:
            candidates.append((score, image_url))

    if not candidates:
        return None

    # Deduplicate while retaining the highest score.
    best_scores = {}

    for score, image_url in candidates:
        best_scores[image_url] = max(
            score,
            best_scores.get(image_url, 0),
        )

    ranked = sorted(
        best_scores.items(),
        key=lambda item: item[1],
        reverse=True,
    )

    return ranked[0][0]


# ============================================================
# DOWNLOAD IMAGE
# ============================================================

def download_image(image_url, faculty_id):
    response = session.get(
        image_url,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()

    content = response.content

    extension = detect_image_extension(
        content[:16],
        response.headers.get("Content-Type"),
    )

    if not extension:
        raise ValueError(
            "The response was not a recognised image file."
        )

    if len(content) < 100:
        raise ValueError("Downloaded image is unexpectedly small.")

    output_path = PHOTO_DIR / f"{faculty_id}.{extension}"

    temporary_path = output_path.with_suffix(
        output_path.suffix + ".tmp"
    )

    try:
        temporary_path.write_bytes(content)
        temporary_path.replace(output_path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()

    return output_path


# ============================================================
# PROCESS ONE FACULTY MEMBER
# ============================================================

def process_faculty(record):
    faculty_id = record.get("faculty_id")
    profile_url = record.get("profile_url")
    faculty_name = record.get("name") or ""

    if not faculty_id or not profile_url:
        raise ValueError(
            "Faculty record is missing faculty_id or profile_url."
        )

    # Reuse an existing valid local photograph.
    existing_path = record.get("photo_local_path")

    if existing_path:
        candidate = DATA_DIR / existing_path

        if is_valid_image_file(candidate):
            record["photo_download_status"] = "downloaded"
            logger.info(
                "Already downloaded: %s",
                faculty_name,
            )
            return "skipped"

    # Also check for existing files by faculty ID.
    existing_files = list(PHOTO_DIR.glob(f"{faculty_id}.*"))

    for candidate in existing_files:
        if is_valid_image_file(candidate):
            record["photo_local_path"] = (
                f"faculty_photos/{candidate.name}"
            )
            record["photo_download_status"] = "downloaded"

            logger.info(
                "Reusing existing photograph: %s",
                faculty_name,
            )
            return "skipped"

    # Fetch the faculty profile.
    response = session.get(
        profile_url,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    image_url = discover_profile_photo(
        soup,
        response.url,
        faculty_name,
    )

    if not image_url:
        record["photo_url"] = None
        record["photo_local_path"] = None
        record["photo_download_status"] = "not_found"

        logger.warning(
            "No photograph found: %s (%s)",
            faculty_name,
            profile_url,
        )

        return "not_found"

    # Download the discovered photograph.
    output_path = download_image(
        image_url,
        faculty_id,
    )

    record["photo_url"] = image_url
    record["photo_local_path"] = (
        f"faculty_photos/{output_path.name}"
    )
    record["photo_download_status"] = "downloaded"

    logger.info(
        "Downloaded: %s -> %s",
        faculty_name,
        output_path.name,
    )

    return "downloaded"


# ============================================================
# MAIN
# ============================================================

def main():
    logger.info("=" * 65)
    logger.info("PES FACULTY PHOTOGRAPH DOWNLOADER")
    logger.info("Faculty JSON: %s", FACULTY_FILE)
    logger.info("Photograph directory: %s", PHOTO_DIR)
    logger.info("=" * 65)

    records = load_faculty()

    downloaded = 0
    skipped = 0
    not_found = 0
    failed = []

    for index, record in enumerate(records, start=1):
        name = record.get("name") or record.get("faculty_id")

        logger.info(
            "[%d/%d] Processing %s",
            index,
            len(records),
            name,
        )

        try:
            result = process_faculty(record)

            if result == "downloaded":
                downloaded += 1
            elif result == "skipped":
                skipped += 1
            elif result == "not_found":
                not_found += 1

        except Exception as exc:
            logger.exception(
                "Photograph download failed for %s",
                name,
            )

            record["photo_download_status"] = "failed"

            failed.append({
                "faculty_id": record.get("faculty_id"),
                "name": name,
                "profile_url": record.get("profile_url"),
                "error": str(exc),
            })

        # Save progress periodically, so an interruption
        # does not lose all JSON updates.
        if index % 10 == 0 or index == len(records):
            save_json(FACULTY_FILE, records)
            save_json(FAILED_FILE, failed)

            logger.info(
                "Progress saved: %d/%d",
                index,
                len(records),
            )

        time.sleep(REQUEST_DELAY_SECONDS)

    save_json(FACULTY_FILE, records)
    save_json(FAILED_FILE, failed)

    logger.info("=" * 65)
    logger.info("PHOTOGRAPH DOWNLOADING COMPLETE")
    logger.info("Total faculty records: %d", len(records))
    logger.info("Downloaded: %d", downloaded)
    logger.info("Already available: %d", skipped)
    logger.info("Not found: %d", not_found)
    logger.info("Failed: %d", len(failed))
    logger.info("Photograph directory: %s", PHOTO_DIR)
    logger.info("Updated faculty JSON: %s", FACULTY_FILE)
    logger.info("Failed records: %s", FAILED_FILE)
    logger.info("=" * 65)


if __name__ == "__main__":
    main()
