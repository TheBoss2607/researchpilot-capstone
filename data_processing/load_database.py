
import os
import json
import hashlib
import re
from pathlib import Path

from neo4j import GraphDatabase


# ============================================================
# CONFIGURATION
# ============================================================

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

SCRIPT_DIR = Path(__file__).resolve().parent

# Existing OpenAlex data directory
OPENALEX_DIR = SCRIPT_DIR / "final_sample"

# New faculty data directory
FACULTY_FILE = SCRIPT_DIR / "faculty" / "faculty_cleaned.json"

# Number of records sent to Neo4j per batch
BATCH_SIZE = 500


# ============================================================
# NEO4J CONNECTION
# ============================================================

def create_driver():
    if not NEO4J_PASSWORD:
        raise RuntimeError(
            "NEO4J_PASSWORD is not set. Set it as an environment "
            "variable before running this script."
        )

    driver = GraphDatabase.driver(
        NEO4J_URI,
        auth=(NEO4J_USER, NEO4J_PASSWORD)
    )

    driver.verify_connectivity()
    return driver


# The driver is initialized in main() so a connection error
# produces a clear message and does not affect module imports.
driver = None


# ============================================================
# GENERAL HELPERS
# ============================================================

def clean_id(value):
    """Convert an OpenAlex URL or ID into its final ID component."""
    if not value:
        return None

    value = str(value).strip().rstrip("/")
    if not value:
        return None

    return value.split("/")[-1]


def normalize_text(value):
    """Normalize text for matching and stable IDs."""
    if not value:
        return ""

    value = str(value).casefold()
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def normalize_research_area(value):
    """
    Produce a stable key for equivalent research-area strings.
    Keep the original wording separately for display.
    """
    value = normalize_text(value)
    value = re.sub(r"[^\w\s]", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def chunks(items, size=BATCH_SIZE):
    """Yield lists of at most size records."""
    for start in range(0, len(items), size):
        yield items[start:start + size]


def load_json(path):
    print(f"Loading {path}...")

    with open(path, "r", encoding="utf-8-sig") as file:
        data = json.load(file)

    if not isinstance(data, list):
        raise ValueError(
            f"Expected a JSON list in {path}, "
            f"but received {type(data).__name__}."
        )

    print(f"  Records found: {len(data):,}")
    return data


def load_openalex_json(filename):
    return load_json(OPENALEX_DIR / filename)


def run_batched(query, records, parameter_name, description):
    """Run a parameterized Cypher query in batches."""
    if not records:
        print(f"{description}: 0 records to process.")
        return

    processed = 0

    with driver.session() as session:
        for batch in chunks(records):
            result = session.run(
                query,
                **{parameter_name: batch}
            )
            result.consume()
            processed += len(batch)

    print(f"{description}: processed {processed:,} records.")


def ensure_constraints():
    """Create uniqueness constraints without deleting existing data."""
    constraints = [
        """
        CREATE CONSTRAINT faculty_id_unique IF NOT EXISTS
        FOR (f:Faculty)
        REQUIRE f.faculty_id IS UNIQUE
        """,
        """
        CREATE CONSTRAINT research_area_name_unique IF NOT EXISTS
        FOR (r:ResearchArea)
        REQUIRE r.normalized_name IS UNIQUE
        """,
        """
        CREATE CONSTRAINT faculty_publication_id_unique IF NOT EXISTS
        FOR (p:FacultyPublication)
        REQUIRE p.publication_id IS UNIQUE
        """,
    ]

    with driver.session() as session:
        for query in constraints:
            session.run(query).consume()

    print("Uniqueness constraints checked.")


# ============================================================
# OPENALEX: AUTHORS
# ============================================================

def load_authors(authors):
    records = []

    for author in authors:
        author_id = clean_id(author.get("id"))
        if not author_id:
            continue

        stats = author.get("summary_stats") or {}

        records.append({
            "id": author_id,
            "displayName": author.get("display_name") or "",
            "hIndex": stats.get("h_index") or 0,
            "i10Index": stats.get("i10_index") or 0,
            "citedByCount": author.get("cited_by_count") or 0,
            "worksCount": author.get("works_count") or 0,
        })

    query = """
    UNWIND $records AS a
    MERGE (author:Author {id: a.id})
    SET
        author.displayName = a.displayName,
        author.name = a.displayName,
        author.hIndex = a.hIndex,
        author.i10Index = a.i10Index,
        author.citedByCount = a.citedByCount,
        author.worksCount = a.worksCount
    """

    run_batched(query, records, "records", "Authors loaded")


# ============================================================
# OPENALEX: INSTITUTIONS
# ============================================================

def load_institutions(institutions):
    records = []

    for institution in institutions:
        institution_id = clean_id(institution.get("id"))
        if not institution_id:
            continue

        records.append({
            "id": institution_id,
            "displayName": institution.get("display_name") or "",
            "country": institution.get("country_code") or "Unknown",
        })

    query = """
    UNWIND $records AS i
    MERGE (inst:Institution {id: i.id})
    SET
        inst.displayName = i.displayName,
        inst.name = i.displayName,
        inst.country = i.country
    """

    run_batched(
        query, records, "records", "Institutions loaded"
    )


# ============================================================
# OPENALEX: CONCEPTS
# ============================================================

def load_concepts(concepts):
    records = []

    for concept in concepts:
        concept_id = clean_id(concept.get("id"))
        if not concept_id:
            continue

        records.append({
            "id": concept_id,
            "displayName": concept.get("display_name") or "",
        })

    query = """
    UNWIND $records AS c
    MERGE (concept:Concept {id: c.id})
    SET
        concept.displayName = c.displayName,
        concept.name = c.displayName
    """

    run_batched(query, records, "records", "Concepts loaded")


# ============================================================
# OPENALEX: TOPICS
# ============================================================

def load_topics(topics):
    records = []

    for topic in topics:
        topic_id = clean_id(topic.get("id"))
        if not topic_id:
            continue

        records.append({
            "id": topic_id,
            "displayName": topic.get("display_name") or "",
        })

    query = """
    UNWIND $records AS t
    MERGE (topic:Topic {id: t.id})
    SET
        topic.displayName = t.displayName,
        topic.name = t.displayName
    """

    run_batched(query, records, "records", "Topics loaded")


# ============================================================
# OPENALEX: WORKS / PAPERS
# ============================================================

def reconstruct_abstract(inverted_index):
    """Reconstruct an OpenAlex abstract from its inverted index."""
    if not isinstance(inverted_index, dict):
        return ""

    words = []

    for word, positions in inverted_index.items():
        if not isinstance(positions, list):
            continue

        for position in positions:
            if isinstance(position, int):
                words.append((position, word))

    words.sort(key=lambda item: item[0])

    return " ".join(word for _, word in words)


def load_works(works):
    records = []

    for work in works:
        work_id = clean_id(work.get("id"))
        if not work_id:
            continue

        records.append({
            "id": work_id,
            "displayName": work.get("display_name") or "",
            "abstract": reconstruct_abstract(
                work.get("abstract_inverted_index")
            ),
            "date": work.get("publication_date") or "",
            "language": work.get("language") or "unknown",
            "citedByCount": work.get("cited_by_count") or 0,
        })

    query = """
    UNWIND $records AS w
    MERGE (work:Work {id: w.id})
    SET
        work.displayName = w.displayName,
        work.title = w.displayName,
        work.abstract = w.abstract,
        work.date = w.date,
        work.language = w.language,
        work.citedByCount = w.citedByCount
    """

    run_batched(query, records, "records", "Works loaded")


# ============================================================
# OPENALEX: AUTHOR-WORK RELATIONSHIPS
# ============================================================

def create_author_work_relationships(works):
    relationships = []

    for work in works:
        work_id = clean_id(work.get("id"))
        if not work_id:
            continue

        for authorship in work.get("authorships") or []:
            author = authorship.get("author") or {}
            author_id = clean_id(author.get("id"))

            if author_id:
                relationships.append({
                    "author_id": author_id,
                    "work_id": work_id,
                })

    query = """
    UNWIND $records AS r
    MATCH (a:Author {id: r.author_id})
    MATCH (w:Work {id: r.work_id})
    MERGE (w)-[:W_A_E]->(a)
    """

    run_batched(
        query, relationships, "records",
        "Author-Work relationships"
    )


# ============================================================
# OPENALEX: AUTHOR-INSTITUTION RELATIONSHIPS
# ============================================================

def create_author_institution_relationships(authors):
    relationships = []

    for author in authors:
        author_id = clean_id(author.get("id"))
        if not author_id:
            continue

        for affiliation in author.get("affiliations") or []:
            institution = affiliation.get("institution") or {}
            institution_id = clean_id(institution.get("id"))

            if institution_id:
                relationships.append({
                    "author_id": author_id,
                    "institution_id": institution_id,
                })

    query = """
    UNWIND $records AS r
    MATCH (a:Author {id: r.author_id})
    MATCH (i:Institution {id: r.institution_id})
    MERGE (a)-[:A_I_E]->(i)
    """

    run_batched(
        query, relationships, "records",
        "Author-Institution relationships"
    )


# ============================================================
# OPENALEX: AUTHOR-CONCEPT RELATIONSHIPS
# ============================================================

def create_author_concept_relationships(authors):
    relationships = []

    for author in authors:
        author_id = clean_id(author.get("id"))
        if not author_id:
            continue

        for concept in author.get("x_concepts") or []:
            concept_id = clean_id(concept.get("id"))

            if concept_id:
                relationships.append({
                    "author_id": author_id,
                    "concept_id": concept_id,
                })

    query = """
    UNWIND $records AS r
    MATCH (a:Author {id: r.author_id})
    MATCH (c:Concept {id: r.concept_id})
    MERGE (a)-[:A_C_E]->(c)
    """

    run_batched(
        query, relationships, "records",
        "Author-Concept relationships"
    )


# ============================================================
# OPENALEX: WORK-CONCEPT RELATIONSHIPS
# ============================================================

def create_work_concept_relationships(works):
    relationships = []

    for work in works:
        work_id = clean_id(work.get("id"))
        if not work_id:
            continue

        for concept in work.get("concepts") or []:
            concept_id = clean_id(concept.get("id"))

            if concept_id:
                relationships.append({
                    "work_id": work_id,
                    "concept_id": concept_id,
                })

    query = """
    UNWIND $records AS r
    MATCH (w:Work {id: r.work_id})
    MATCH (c:Concept {id: r.concept_id})
    MERGE (w)-[:W_C_E]->(c)
    """

    run_batched(
        query, relationships, "records",
        "Work-Concept relationships"
    )


# ============================================================
# FACULTY: PREPARE DATA
# ============================================================

def json_string(value):
    """Serialize nested metadata safely as a Neo4j string property."""
    if value is None:
        return None

    return json.dumps(value, ensure_ascii=False)


def prepare_faculty_records(faculty_data):
    """
    Prepare faculty properties, research areas, and publication
    candidates for import. No scraped candidate is treated as
    a verified OpenAlex publication.
    """
    faculty_records = []
    area_records = []
    publication_records = []

    # Keyed by normalized area name to reduce duplicate work.
    unique_areas = {}

    for person in faculty_data:
        faculty_id = str(person.get("faculty_id") or "").strip()
        name = str(person.get("name") or "").strip()

        # faculty_id is the stable source identifier.
        if not faculty_id or not name:
            print(
                "Skipping faculty record without faculty_id/name."
            )
            continue

        research_areas = person.get("research_areas") or []
        valid_areas = []

        for area in research_areas:
            if not isinstance(area, str):
                continue

            display_area = re.sub(r"\s+", " ", area).strip()
            normalized = normalize_research_area(display_area)

            if not display_area or not normalized:
                continue

            valid_areas.append(display_area)

            if normalized not in unique_areas:
                unique_areas[normalized] = {
                    "normalized_name": normalized,
                    "name": display_area,
                }

            area_records.append({
                "faculty_id": faculty_id,
                "normalized_name": normalized,
            })

        # Prefer the cleaner's publication candidates, which exclude
        # entries it has rejected as skills/tools or encoding issues.
        publications = person.get(
            "publication_candidates_for_matching"
        )

        # Fallback for records without the candidate field.
        if publications is None:
            publications = person.get("publications_raw") or []

        seen_publications = set()

        for publication in publications:
            if not isinstance(publication, str):
                continue

            publication_text = re.sub(
                r"\s+", " ", publication
            ).strip()

            normalized_publication = normalize_text(
                publication_text
            )

            if not normalized_publication:
                continue

            if normalized_publication in seen_publications:
                continue

            seen_publications.add(normalized_publication)

            # Stable ID from faculty ID + normalized publication text.
            digest = hashlib.sha256(
                normalized_publication.encode("utf-8")
            ).hexdigest()[:24]

            publication_id = f"{faculty_id}:{digest}"

            publication_records.append({
                "publication_id": publication_id,
                "faculty_id": faculty_id,
                "title": publication_text,
                "source_text": publication_text,
                "data_source": person.get("data_source"),
                "profile_url": person.get("profile_url"),
                "verification_status": "unverified_candidate",
            })

        properties = {
            "faculty_id": faculty_id,
            "name": name,
            "department": person.get("department"),
            "campus": person.get("campus"),
            "designation": person.get("designation"),
            "profile_url": person.get("profile_url"),
            "photo_url": person.get("photo_url"),
            "data_source": person.get("data_source"),
            "last_scraped_utc": person.get("last_scraped_utc"),
            "verification_status": person.get(
                "verification_status"
            ),
            "source_verification_status": person.get(
                "source_verification_status"
            ),
            "research_areas": valid_areas,
            "research_areas_raw": person.get(
                "research_areas_raw"
            ) or [],
            "research_areas_rejected_for_review_json": json_string(
                person.get("research_areas_rejected_for_review")
                or []
            ),
            "data_consistency_warnings": person.get(
                "data_consistency_warnings"
            ) or [],
            "cleaning_issues": person.get("cleaning_issues") or [],
            "publication_encoding_problems_json": json_string(
                person.get("publication_encoding_problems") or []
            ),
            "publication_entries_rejected_for_review_json": json_string(
                person.get("publication_entries_rejected_for_review")
                or []
            ),
            "publication_links_json": json_string(
                person.get("publication_links") or []
            ),
            "publications_raw": person.get("publications_raw") or [],
        }

        faculty_records.append({"properties": properties})

    # A separate ResearchArea node is shared across faculty members.
    area_node_records = list(unique_areas.values())

    return (
        faculty_records,
        area_node_records,
        area_records,
        publication_records,
    )


# ============================================================
# FACULTY: IMPORT FACULTY NODES
# ============================================================

def load_faculty_nodes(faculty_records):
    query = """
    UNWIND $records AS row
    MERGE (f:Faculty {faculty_id: row.properties.faculty_id})
    SET f += row.properties
    """

    run_batched(
        query, faculty_records, "records", "Faculty nodes loaded"
    )


# ============================================================
# FACULTY: IMPORT RESEARCH AREAS
# ============================================================

def load_research_area_nodes(area_records):
    query = """
    UNWIND $records AS r
    MERGE (area:ResearchArea {
        normalized_name: r.normalized_name
    })
    ON CREATE SET area.name = r.name
    """

    run_batched(
        query, area_records, "records", "ResearchArea nodes loaded"
    )


def create_faculty_research_area_relationships(area_relationships):
    query = """
    UNWIND $records AS r
    MATCH (f:Faculty {faculty_id: r.faculty_id})
    MATCH (area:ResearchArea {
        normalized_name: r.normalized_name
    })
    MERGE (f)-[:HAS_RESEARCH_AREA]->(area)
    """

    run_batched(
        query,
        area_relationships,
        "records",
        "Faculty-ResearchArea relationships"
    )


# ============================================================
# FACULTY: IMPORT PUBLICATION CANDIDATES
# ============================================================

def load_faculty_publication_nodes(publications):
    query = """
    UNWIND $records AS p
    MERGE (pub:FacultyPublication {
        publication_id: p.publication_id
    })
    SET
        pub.title = p.title,
        pub.source_text = p.source_text,
        pub.data_source = p.data_source,
        pub.profile_url = p.profile_url,
        pub.verification_status = p.verification_status
    """

    run_batched(
        query,
        publications,
        "records",
        "Faculty publication candidates loaded"
    )


def create_faculty_publication_relationships(publications):
    query = """
    UNWIND $records AS p
    MATCH (f:Faculty {faculty_id: p.faculty_id})
    MATCH (pub:FacultyPublication {
        publication_id: p.publication_id
    })
    MERGE (f)-[:HAS_PUBLICATION]->(pub)
    """

    run_batched(
        query,
        publications,
        "records",
        "Faculty-publication relationships"
    )


# ============================================================
# FACULTY: COMPLETE IMPORT
# ============================================================

def load_faculty_data():
    print()
    print("=" * 65)
    print("PES FACULTY DATA → NEO4J")
    print("=" * 65)

    if not FACULTY_FILE.exists():
        print(f"Faculty file not found: {FACULTY_FILE}")
        print("Skipping faculty import; OpenAlex import can continue.")
        return

    faculty_data = load_json(FACULTY_FILE)

    (
        faculty_records,
        area_node_records,
        area_relationships,
        publication_records,
    ) = prepare_faculty_records(faculty_data)

    print()
    print("Faculty import summary:")
    print(f"  Faculty records: {len(faculty_records):,}")
    print(f"  Unique research areas: {len(area_node_records):,}")
    print(f"  Faculty-area links: {len(area_relationships):,}")
    print(f"  Publication candidates: {len(publication_records):,}")
    print()

    load_faculty_nodes(faculty_records)
    load_research_area_nodes(area_node_records)
    create_faculty_research_area_relationships(area_relationships)

    load_faculty_publication_nodes(publication_records)
    create_faculty_publication_relationships(publication_records)

    print("Faculty import complete.")


# ============================================================
# MAIN
# ============================================================

def main():
    global driver

    print()
    print("=" * 65)
    print("RESEARCHPILOT: OPENALEX + FACULTY NEO4J LOADER")
    print("=" * 65)
    print()

    driver = create_driver()

    try:
        ensure_constraints()

        # ----------------------------------------------------
        # Load existing OpenAlex JSON files.
        # Keep these filenames compatible with your current setup.
        # ----------------------------------------------------
        authors = load_openalex_json("authors.json")
        concepts = load_openalex_json("concepts.json")
        institutions = load_openalex_json("instituions.json")
        topics = load_openalex_json("topics.json")
        works = load_openalex_json("works.json")

        print()
        print("=" * 65)
        print("LOADING OPENALEX NODES")
        print("=" * 65)

        load_authors(authors)
        load_institutions(institutions)
        load_concepts(concepts)
        load_topics(topics)
        load_works(works)

        print()
        print("=" * 65)
        print("CREATING OPENALEX RELATIONSHIPS")
        print("=" * 65)

        create_author_work_relationships(works)
        create_author_institution_relationships(authors)
        create_author_concept_relationships(authors)
        create_work_concept_relationships(works)

        print()
        print("=" * 65)
        print("LOADING FACULTY DATA")
        print("=" * 65)

        load_faculty_data()

        print()
        print("=" * 65)
        print("ALL DATABASE LOADING OPERATIONS COMPLETE")
        print("=" * 65)

    finally:
        if driver is not None:
            driver.close()


if __name__ == "__main__":
    main()
