
import json
import os
from pathlib import Path

from neo4j import GraphDatabase


# ============================================================
# CONFIGURATION
# ============================================================

DATA_DIR = Path(__file__).resolve().parent

FACULTY_FILE = DATA_DIR / "faculty_raw.json"
PHOTO_DIR = DATA_DIR / "faculty_photos"

# Configure these environment variables using the same
# Neo4j connection details as your existing RESEARCHPILOT backend.
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")

BATCH_SIZE = 100


# ============================================================
# LOAD FACULTY JSON
# ============================================================

def load_faculty_records():

    if not FACULTY_FILE.exists():
        raise FileNotFoundError(
            f"Faculty JSON not found: {FACULTY_FILE}"
        )

    with FACULTY_FILE.open("r", encoding="utf-8") as file:
        records = json.load(file)

    if not isinstance(records, list):
        raise ValueError(
            "faculty_raw.json must contain a JSON array."
        )

    return records


# ============================================================
# PREPARE PHOTO RECORDS
# ============================================================

def prepare_photo_records(records):

    prepared = []
    missing_images = []

    for record in records:

        faculty_id = record.get("faculty_id")

        if not faculty_id:
            continue

        relative_path = record.get("photo_local_path")
        source_url = record.get("photo_url")

        if not relative_path:
            missing_images.append(faculty_id)
            continue

        # Resolve the relative image path inside data_processing.
        image_path = DATA_DIR / relative_path

        if not image_path.is_file():
            print(
                f"WARNING: Image file missing for {faculty_id}: "
                f"{image_path}"
            )
            missing_images.append(faculty_id)
            continue

        prepared.append({
            "faculty_id": str(faculty_id),
            "photo_local_path": relative_path.replace("\\", "/"),
            "photo_source_url": source_url,
            "photo_download_status": "downloaded"
        })

    return prepared, missing_images


# ============================================================
# UPDATE EXISTING NEO4J FACULTY NODES
# ============================================================

def update_neo4j(driver, photo_records):

    if not photo_records:
        print("No valid faculty photographs to update.")
        return

    # First identify which faculty IDs already exist.
    check_query = """
    UNWIND $records AS row

    OPTIONAL MATCH (f:Faculty {
        faculty_id: row.faculty_id
    })

    RETURN
        row.faculty_id AS faculty_id,
        f IS NOT NULL AS matched
    """

    matched_ids = set()
    unmatched_ids = []

    for start in range(0, len(photo_records), BATCH_SIZE):

        batch = photo_records[start:start + BATCH_SIZE]

        results, _, _ = driver.execute_query(
            check_query,
            records=batch,
            database_=NEO4J_DATABASE
        )

        for result in results:

            if result["matched"]:
                matched_ids.add(result["faculty_id"])
            else:
                unmatched_ids.append(result["faculty_id"])

    # Update only existing nodes.
    update_query = """
    UNWIND $records AS row

    MATCH (f:Faculty {
        faculty_id: row.faculty_id
    })

    SET
        f.photo_local_path = row.photo_local_path,
        f.photo_source_url = coalesce(
            row.photo_source_url,
            f.photo_source_url
        ),
        f.photo_download_status = row.photo_download_status

    RETURN count(f) AS updated_count
    """

    total_updated = 0

    for start in range(0, len(photo_records), BATCH_SIZE):

        batch = photo_records[start:start + BATCH_SIZE]

        results, summary, _ = driver.execute_query(
            update_query,
            records=batch,
            database_=NEO4J_DATABASE
        )

        updated_count = (
            results[0]["updated_count"]
            if results else 0
        )

        total_updated += updated_count

        print(
            f"Updated batch: {updated_count} faculty records"
        )

    print("\n" + "=" * 60)
    print("NEO4J FACULTY PHOTOGRAPH UPDATE COMPLETE")
    print("=" * 60)

    print("Photograph records prepared:", len(photo_records))
    print("Existing faculty nodes matched:", len(matched_ids))
    print("Faculty nodes updated:", total_updated)
    print("Unmatched faculty IDs:", len(unmatched_ids))

    if unmatched_ids:
        print("\nUnmatched IDs:")

        for faculty_id in unmatched_ids:
            print(" -", faculty_id)

    print("=" * 60)


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 60)
    print("RESEARCHPILOT - NEO4J FACULTY PHOTO UPDATE")
    print("=" * 60)

    if not NEO4J_PASSWORD:
        raise ValueError(
            "NEO4J_PASSWORD is not configured. "
            "Set your Neo4j credentials before running this script."
        )

    records = load_faculty_records()

    print("Faculty JSON records:", len(records))

    photo_records, missing_images = prepare_photo_records(
        records
    )

    print("Valid downloaded photographs:", len(photo_records))
    print("Missing photographs:", len(missing_images))

    if not photo_records:
        print("No photographs available for Neo4j update.")
        return

    driver = GraphDatabase.driver(
        NEO4J_URI,
        auth=(NEO4J_USERNAME, NEO4J_PASSWORD)
    )

    try:
        driver.verify_connectivity()

        print("Connected to Neo4j successfully.")

        update_neo4j(
            driver,
            photo_records
        )

    finally:
        driver.close()


if __name__ == "__main__":
    main()
