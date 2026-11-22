
import json
import re
import sys
import traceback
import unicodedata
from pathlib import Path
from collections import Counter


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

POSSIBLE_INPUTS = [
    BASE_DIR / "faculty_raw.json",
    BASE_DIR / "faculty_data" / "faculty_raw.json",
]

GENERIC_PHOTO_MARKERS = [
    "pesu-staff-dark.png",
    "placeholder",
    "default-avatar",
    "no-image",
]

BAD_DEPARTMENT_PATTERNS = [
    r"\bcontact\s+email\b",
    r"\bphone\b",
    r"\bdepartment\s*:",
    r"\bcampus\s+ec\s+campus\b",
    r"\+?\d[\d\s().-]{7,}\d",
    r"\b[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}\b",
]

BAD_RESEARCH_PHRASES = [
    "one student graduated",
    "one research scholar",
    "research scholars",
    "currently guiding",
    "looking for full time project staff",
    "looking for full-time project staff",
    "desirable qualification",
    "pay will be discussed",
    "interested candidates",
    "apply now",
    "job opening",
    "recruitment",
    "vacancy",
    "walk-in interview",
    "walk in interview",
    "contact for details",
    "email me",
]

PROJECT_PHRASES = [
    "research project",
    "research projects",
    "project staff",
    "project title",
    "project funded",
    "funded project",
    "project duration",
    "principal investigator",
    "co-principal investigator",
]

SKILLS_PHRASES = [
    "software skills",
    "programming language",
    "programming languages",
    "software tools",
    "technical skills",
    "proficiency in",
]

PUBLICATION_SUMMARY_PHRASES = [
    "publications can be found",
    "latest publications can be found",
    "latest publications can be viewed",
    "view my publications",
    "list of publications",
    "selected publications",
    "publication list",
]

RESEARCH_INTEREST_PREFIXES = [
    r"^\s*research interests include\s*:\s*",
    r"^\s*research interest includes\s*:\s*",
    r"^\s*research interests\s*:\s*",
    r"^\s*research interest\s*:\s*",
    r"^\s*areas of research\s*:\s*",
    r"^\s*area of research\s*:\s*",
]

TECHNICAL_RESEARCH_TERMS = [
    "machine learning",
    "deep learning",
    "computer vision",
    "wireless communication",
    "signal processing",
    "fluid dynamics",
    "highway geometric design",
    "transportation engineering",
    "thermal barrier coating",
    "3d printing",
    "natural language processing",
    "graph neural network",
    "data mining",
    "artificial intelligence",
]


# ============================================================
# BASIC HELPERS
# ============================================================

def clean_text(value):
    """Normalize Unicode and whitespace."""
    if not isinstance(value, str):
        return value

    value = unicodedata.normalize("NFC", value)
    value = value.replace("\u00a0", " ")
    value = re.sub(r"\s+", " ", value)

    return value.strip()


def normalized_key(value):
    """Create a normalized comparison key for duplicate detection."""
    value = clean_text(value)

    if not isinstance(value, str):
        return ""

    value = value.casefold()
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"[\"'`“”‘’]", "", value)
    value = re.sub(r"[.,;:]+$", "", value)

    return value.strip()


def as_list(value):
    """Convert a string or list into a list."""
    if isinstance(value, list):
        return value

    if isinstance(value, str) and value.strip():
        return [value]

    return []


def unique_texts(values):
    """Remove duplicate strings while preserving order."""
    result = []
    seen = set()

    for value in values:
        value = clean_text(value)

        if not isinstance(value, str) or not value:
            continue

        key = normalized_key(value)

        if key and key not in seen:
            seen.add(key)
            result.append(value)

    return result


def contains_any(text, phrases):
    lower = text.casefold()
    return any(phrase.casefold() in lower for phrase in phrases)


def has_replacement_character(text):
    return isinstance(text, str) and "\ufffd" in text


def find_input_file():
    """Find faculty_raw.json without guessing another input file."""
    for path in POSSIBLE_INPUTS:
        if path.is_file():
            return path

    available_json = sorted(
        str(path.relative_to(BASE_DIR))
        for path in BASE_DIR.rglob("*.json")
        if path.is_file()
    )

    raise FileNotFoundError(
        "Could not find faculty_raw.json.\n\n"
        "Expected one of:\n"
        + "\n".join(f"  {path}" for path in POSSIBLE_INPUTS)
        + "\n\nJSON files found:\n"
        + (
            "\n".join(f"  {path}" for path in available_json)
            if available_json
            else "  No JSON files found."
        )
    )


def load_records(path):
    """Load a JSON list or a common wrapped JSON structure."""
    with path.open("r", encoding="utf-8-sig") as file:
        data = json.load(file)

    if isinstance(data, list):
        records = data

    elif isinstance(data, dict):
        records = None

        for key in ("faculty", "staff", "records", "data"):
            if isinstance(data.get(key), list):
                records = data[key]
                break

        if records is None:
            raise ValueError(
                "No faculty list found under 'faculty', 'staff', "
                "'records', or 'data'."
            )
    else:
        raise ValueError(
            "The JSON root must be a list or an object containing a list."
        )

    invalid_count = sum(
        not isinstance(record, dict) for record in records
    )

    if invalid_count:
        print(
            f"WARNING: Skipping {invalid_count} record(s) "
            "that are not JSON objects."
        )

    return [
        record for record in records
        if isinstance(record, dict)
    ]


# ============================================================
# DEPARTMENT VALIDATION
# ============================================================

def department_problem(value):
    """Check department formatting without guessing its true value."""
    if not isinstance(value, str) or not value.strip():
        return "missing_department"

    text = clean_text(value)

    if len(text) > 100:
        return "department_too_long"

    for pattern in BAD_DEPARTMENT_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return "department_contains_contact_or_page_text"

    if "on this page" in text.casefold():
        return "department_contains_page_text"

    return None


def department_consistency_warnings(department, research_areas):
    """
    Flag a possible mismatch. This never changes the department value.
    Such warnings require verification against the actual profile.
    """
    if not department:
        return []

    combined = " ".join(research_areas).casefold()

    has_technical_research = any(
        term in combined for term in TECHNICAL_RESEARCH_TERMS
    )

    if (
        department.casefold() == "commerce"
        and has_technical_research
    ):
        return [
            "department_may_conflict_with_technical_research"
        ]

    return []


# ============================================================
# RESEARCH-AREA CLEANING
# ============================================================

def strip_research_interest_prefix(text):
    """Remove introductory wording from research-interest statements."""
    for pattern in RESEARCH_INTEREST_PREFIXES:
        updated = re.sub(
            pattern,
            "",
            text,
            flags=re.IGNORECASE,
        )

        if updated != text:
            return updated.strip()

    return text


def research_area_problem(value):
    """Return a reason if a research-area entry should be reviewed."""
    if not isinstance(value, str) or not value.strip():
        return "empty_item"

    text = clean_text(value)
    lower = text.casefold()

    if has_replacement_character(text):
        return "encoding_problem"

    if contains_any(text, BAD_RESEARCH_PHRASES):
        return "administrative_or_recruitment_text"

    if contains_any(text, PROJECT_PHRASES):
        return "possible_project_or_project_administration"

    if contains_any(text, SKILLS_PHRASES):
        return "skills_or_tools_not_research_area"

    if contains_any(text, PUBLICATION_SUMMARY_PHRASES):
        return "publication_link_or_summary_not_research_area"

    if len(text) > 180:
        return "long_text_needs_review"

    if re.search(r"\b(19|20)\d{2}\b", text) and any(
        word in lower
        for word in ("doi", "journal", "proceedings", "conference")
    ):
        return "possible_publication_not_research_area"

    return None


def clean_research_areas(raw_areas):
    """
    Clean research-area entries.

    Comma-separated values are split only when the original entry
    explicitly begins with a research-interest heading.
    Suspicious entries are preserved for manual review.
    """
    accepted = []
    rejected = []

    for original in as_list(raw_areas):
        if not isinstance(original, str):
            continue

        original = clean_text(original)

        if not original:
            continue

        explicitly_introduced = any(
            re.match(pattern, original, flags=re.IGNORECASE)
            for pattern in RESEARCH_INTEREST_PREFIXES
        )

        text = strip_research_interest_prefix(original)

        if explicitly_introduced:
            items = [
                clean_text(part)
                for part in text.split(",")
                if clean_text(part)
            ]
        else:
            items = [text]

        for item in items:
            reason = research_area_problem(item)

            if reason:
                rejected.append({
                    "text": original,
                    "reason": reason,
                })
            else:
                accepted.append(item)

    return unique_texts(accepted), rejected


# ============================================================
# PUBLICATION CLEANING
# ============================================================

def looks_like_non_publication(value):
    """Detect obvious non-publication entries."""
    if contains_any(value, PUBLICATION_SUMMARY_PHRASES):
        return "publication_page_link_or_summary"

    if contains_any(value, BAD_RESEARCH_PHRASES):
        return "administrative_or_recruitment_text"

    if contains_any(value, SKILLS_PHRASES):
        return "skills_or_tools_not_publication"

    if value.casefold().startswith("programming language"):
        return "skills_or_tools_not_publication"

    return None


def publication_kind(value):
    """
    Classify an entry without claiming the publication has been verified.
    """
    text = clean_text(value)

    if not isinstance(text, str) or not text:
        return "empty"

    if has_replacement_character(text):
        return "encoding_problem"

    if looks_like_non_publication(text):
        return "non_publication_text"

    if re.search(r"https?://", text, re.IGNORECASE):
        if (
            len(text) < 100
            or contains_any(text, PUBLICATION_SUMMARY_PHRASES)
        ):
            return "link_needs_processing"

    # Retain citations even when they do not contain a recognizable
    # venue or year. They remain unverified candidates.
    return "unverified_publication_candidate"


def clean_publications(raw_publications):
    """Separate publication candidates, links, and suspicious entries."""
    source_entries = unique_texts([
        item
        for item in as_list(raw_publications)
        if isinstance(item, str) and clean_text(item)
    ])

    candidates = []
    links = []
    rejected = []
    encoding_problems = []

    for item in source_entries:
        kind = publication_kind(item)

        if kind == "link_needs_processing":
            links.append(item)

        elif kind == "non_publication_text":
            rejected.append({
                "text": item,
                "reason": (
                    looks_like_non_publication(item)
                    or "not_a_publication"
                ),
            })

        elif kind == "encoding_problem":
            encoding_problems.append(item)
            rejected.append({
                "text": item,
                "reason": "encoding_problem_do_not_auto_repair",
            })

        elif kind == "unverified_publication_candidate":
            candidates.append(item)

    return {
        "source_entries": source_entries,
        "candidates": unique_texts(candidates),
        "links": unique_texts(links),
        "rejected": rejected,
        "encoding_problems": unique_texts(encoding_problems),
    }


# ============================================================
# CLEAN ONE FACULTY RECORD
# ============================================================

def clean_faculty_record(raw):
    record = dict(raw)
    issues = []

    faculty_id = clean_text(raw.get("faculty_id"))
    name = clean_text(raw.get("name"))

    record["faculty_id"] = faculty_id or None
    record["name"] = name or None

    # Department
    department = clean_text(raw.get("department"))
    department_issue = department_problem(department)

    if department_issue:
        record["department_raw"] = department
        record["department"] = None
        issues.append(department_issue)
    else:
        record["department"] = department

    # Designation
    designation = clean_text(raw.get("designation"))
    record["designation"] = designation or None

    if not designation:
        issues.append("designation_missing")

    # Profile URL
    profile_url = clean_text(raw.get("profile_url"))

    if (
        not isinstance(profile_url, str)
        or not re.match(r"^https?://", profile_url, re.IGNORECASE)
    ):
        record["profile_url_raw"] = profile_url
        record["profile_url"] = None
        issues.append("profile_url_missing_or_invalid")
    else:
        record["profile_url"] = profile_url

    # Photo
    photo = clean_text(raw.get("photo_url"))

    if not photo:
        record["photo_url"] = None
        issues.append("photo_missing")

    elif any(
        marker in photo.casefold()
        for marker in GENERIC_PHOTO_MARKERS
    ):
        record["photo_url_raw"] = photo
        record["photo_url"] = None
        issues.append("generic_placeholder_photo")

    elif not re.match(r"^https?://", photo, re.IGNORECASE):
        record["photo_url_raw"] = photo
        record["photo_url"] = None
        issues.append("photo_url_invalid")

    else:
        record["photo_url"] = photo

    # Research areas
    raw_areas = [
        clean_text(item)
        for item in as_list(raw.get("research_areas"))
        if isinstance(item, str) and clean_text(item)
    ]

    record["research_areas_raw"] = raw_areas

    accepted_areas, rejected_areas = clean_research_areas(raw_areas)

    record["research_areas"] = accepted_areas
    record["research_areas_rejected_for_review"] = rejected_areas

    if rejected_areas:
        issues.append("research_area_entries_need_review")

    if not accepted_areas:
        issues.append("no_usable_research_areas")

    if len(accepted_areas) < len(raw_areas):
        issues.append("research_areas_filtered_or_deduplicated")

    consistency_warnings = department_consistency_warnings(
        record.get("department"),
        accepted_areas,
    )

    record["data_consistency_warnings"] = consistency_warnings
    issues.extend(consistency_warnings)

    # Publications
    raw_publications = [
        clean_text(item)
        for item in as_list(raw.get("publications_raw"))
        if isinstance(item, str) and clean_text(item)
    ]

    publication_data = clean_publications(raw_publications)

    record["publications_raw"] = publication_data["source_entries"]

    record["publication_candidates_for_matching"] = (
        publication_data["candidates"]
    )

    record["publication_links"] = publication_data["links"]

    record["publication_entries_rejected_for_review"] = (
        publication_data["rejected"]
    )

    record["publication_encoding_problems"] = (
        publication_data["encoding_problems"]
    )

    if not publication_data["source_entries"]:
        issues.append("no_publication_data")

    if publication_data["links"]:
        issues.append("publication_links_need_processing")

    if publication_data["rejected"]:
        issues.append("publication_entries_need_review")

    if publication_data["encoding_problems"]:
        issues.append("publication_encoding_problem")

    # Basic validation
    if not name:
        issues.append("name_missing")

    if not faculty_id:
        issues.append("faculty_id_missing")

    campus = record.get("campus")

    if not isinstance(campus, str) or not campus.strip():
        issues.append("campus_missing")

    # Preserve the original scraper status for auditing.
    record["source_verification_status"] = raw.get(
        "verification_status"
    )

    record["cleaning_issues"] = sorted(set(issues))

    record["verification_status"] = (
        "needs_manual_validation"
        if issues
        else "cleaned_needs_verification"
    )

    return record


# ============================================================
# DUPLICATE CHECKS
# ============================================================

def find_duplicate_ids(records):
    counts = Counter(
        record["faculty_id"]
        for record in records
        if record.get("faculty_id")
    )

    return sorted(
        faculty_id
        for faculty_id, count in counts.items()
        if count > 1
    )


def find_duplicate_names(records):
    counts = Counter(
        normalized_key(record["name"])
        for record in records
        if record.get("name")
    )

    return sorted(
        name
        for name, count in counts.items()
        if name and count > 1
    )


# ============================================================
# MAIN PROCESS
# ============================================================

def main():
    input_file = find_input_file()
    output_dir = input_file.parent

    clean_file = output_dir / "faculty_cleaned.json"
    review_file = output_dir / "faculty_review_required.json"
    report_file = output_dir / "faculty_validation_report.json"

    print(f"Input file: {input_file}")
    print("Reading faculty records...")

    raw_records = load_records(input_file)

    if not raw_records:
        raise ValueError("No valid faculty records were found.")

    print(f"Loaded {len(raw_records)} faculty records.")
    print("Cleaning records...")

    cleaned = [
        clean_faculty_record(record)
        for record in raw_records
    ]

    review = [
        record for record in cleaned
        if record["cleaning_issues"]
    ]

    duplicate_ids = find_duplicate_ids(cleaned)
    duplicate_names = find_duplicate_names(cleaned)

    issue_counts = Counter(
        issue
        for record in cleaned
        for issue in record["cleaning_issues"]
    )

    records_with_areas = [
        record for record in cleaned
        if record["research_areas"]
    ]

    records_with_publications = [
        record for record in cleaned
        if record["publication_candidates_for_matching"]
    ]

    records_with_encoding_problems = [
        record for record in cleaned
        if (
            record["publication_encoding_problems"]
            or any(
                item.get("reason") == "encoding_problem"
                for item in record["research_areas_rejected_for_review"]
            )
        )
    ]

    report = {
        "input_file": str(input_file),
        "total_faculty_records": len(cleaned),
        "records_requiring_review": len(review),
        "records_without_review_flags": len(cleaned) - len(review),
        "records_with_usable_research_areas": len(records_with_areas),
        "records_with_publication_candidates": len(records_with_publications),
        "records_with_encoding_problems": len(records_with_encoding_problems),
        "duplicate_faculty_ids": duplicate_ids,
        "duplicate_names_for_manual_check": duplicate_names,
        "records_missing_name": [
            record.get("faculty_id") or "(missing ID)"
            for record in cleaned
            if not record.get("name")
        ],
        "records_missing_faculty_id": [
            record.get("name") or "(missing name)"
            for record in cleaned
            if not record.get("faculty_id")
        ],
        "records_missing_department": [
            record.get("faculty_id") or record.get("name")
            for record in cleaned
            if not record.get("department")
        ],
        "records_missing_designation": [
            record.get("faculty_id") or record.get("name")
            for record in cleaned
            if not record.get("designation")
        ],
        "records_missing_photo": [
            record.get("faculty_id") or record.get("name")
            for record in cleaned
            if not record.get("photo_url")
        ],
        "issue_counts": dict(sorted(issue_counts.items())),
        "important_notes": [
            "The original faculty_raw.json is never overwritten.",
            (
                "Rejected research-area entries remain available "
                "for manual review."
            ),
            (
                "Department mismatch warnings are not proof of an error; "
                "verify the department against the faculty profile."
            ),
            (
                "Publication candidates are not verified bibliographic "
                "records."
            ),
            (
                "Encoding replacement characters must be checked against "
                "the original source before correction."
            ),
        ],
    }

    print("Writing output files...")

    outputs = [
        (clean_file, cleaned),
        (review_file, review),
        (report_file, report),
    ]

    for path, data in outputs:
        with path.open("w", encoding="utf-8") as file:
            json.dump(
                data,
                file,
                indent=2,
                ensure_ascii=False,
            )

    print("\n" + "=" * 55)
    print("FACULTY CLEANING FINISHED")
    print("=" * 55)
    print(f"Total records: {len(cleaned)}")
    print(f"Records requiring review: {len(review)}")
    print(f"Records with research areas: {len(records_with_areas)}")
    print(
        "Records with publication candidates: "
        f"{len(records_with_publications)}"
    )
    print(f"Duplicate faculty IDs: {len(duplicate_ids)}")
    print(f"Duplicate names to check: {len(duplicate_names)}")
    print(f"\nCleaned data: {clean_file}")
    print(f"Review list: {review_file}")
    print(f"Validation report: {report_file}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"\nERROR: {error}", file=sys.stderr)
        print("\nFull error details:", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
