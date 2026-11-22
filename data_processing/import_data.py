from neo4j import GraphDatabase
import json
import os


# ============================================================
# CONFIGURATION
# ============================================================

URI = "bolt://localhost:7687"
USERNAME = "neo4j"
PASSWORD = "jahnavi17"

DATA_DIR = os.path.join(
    os.path.dirname(__file__),
    "final_sample"
)


# ============================================================
# LOAD JSON
# ============================================================

def load_json(filename):
    path = os.path.join(DATA_DIR, filename)

    print(f"Loading {filename}...")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"  Loaded {len(data)} records")

    return data


# ============================================================
# IMPORT DATABASE
# ============================================================

def import_data():

    driver = GraphDatabase.driver(
        URI,
        auth=(USERNAME, PASSWORD)
    )

    try:

        print("\n========================================")
        print("STARTING RESEARCH GRAPH IMPORT")
        print("========================================\n")


        # ----------------------------------------------------
        # LOAD FILES
        # ----------------------------------------------------

        authors = load_json("authors.json")
        works = load_json("works.json")
        concepts = load_json("concepts.json")
        topics = load_json("topics.json")
        institutions = load_json("instituions.json")


        # ----------------------------------------------------
        # CREATE CONSTRAINTS
        # ----------------------------------------------------

        print("\nCreating database constraints...")

        with driver.session() as session:

            session.run("""
                CREATE CONSTRAINT author_id IF NOT EXISTS
                FOR (a:Author)
                REQUIRE a.id IS UNIQUE
            """)

            session.run("""
                CREATE CONSTRAINT work_id IF NOT EXISTS
                FOR (w:Work)
                REQUIRE w.id IS UNIQUE
            """)

            session.run("""
                CREATE CONSTRAINT institution_id IF NOT EXISTS
                FOR (i:Institution)
                REQUIRE i.id IS UNIQUE
            """)

            session.run("""
                CREATE CONSTRAINT concept_id IF NOT EXISTS
                FOR (c:Concept)
                REQUIRE c.id IS UNIQUE
            """)

            session.run("""
                CREATE CONSTRAINT topic_id IF NOT EXISTS
                FOR (t:Topic)
                REQUIRE t.id IS UNIQUE
            """)

        print("Constraints created.")


        # ----------------------------------------------------
        # AUTHORS
        # ----------------------------------------------------

        print("\nImporting authors...")

        with driver.session() as session:

            for author in authors:

                session.run("""
                    MERGE (a:Author {id: $id})

                    SET
                        a.displayName = $displayName,
                        a.worksCount = $worksCount,
                        a.citedByCount = $citedByCount,
                        a.hIndex = $hIndex,
                        a.i10Index = $i10Index

                """,
                id=author.get("id"),
                displayName=author.get("display_name"),
                worksCount=author.get("works_count", 0),
                citedByCount=author.get("cited_by_count", 0),
                hIndex=author.get("summary_stats", {}).get("h_index", 0),
                i10Index=author.get("summary_stats", {}).get("i10_index", 0)
                )

        print(f"Imported {len(authors)} authors.")


        # ----------------------------------------------------
        # INSTITUTIONS
        # ----------------------------------------------------

        print("\nImporting institutions...")

        institution_count = 0

        with driver.session() as session:

            for institution in institutions:

                session.run("""
                    MERGE (i:Institution {id: $id})

                    SET
                        i.displayName = $displayName,
                        i.country = $country

                """,
                id=institution.get("id"),
                displayName=institution.get("display_name"),
                country=institution.get("country_code", "Unknown")
                )

                institution_count += 1

        print(f"Imported {institution_count} institutions.")


        # ----------------------------------------------------
        # CONCEPTS
        # ----------------------------------------------------

        print("\nImporting concepts...")

        with driver.session() as session:

            for concept in concepts:

                session.run("""
                    MERGE (c:Concept {id: $id})

                    SET
                        c.displayName = $displayName

                """,
                id=concept.get("id"),
                displayName=concept.get("display_name")
                )

        print(f"Imported {len(concepts)} concepts.")


        # ----------------------------------------------------
        # TOPICS
        # ----------------------------------------------------

        print("\nImporting topics...")

        with driver.session() as session:

            for topic in topics:

                session.run("""
                    MERGE (t:Topic {id: $id})

                    SET
                        t.displayName = $displayName

                """,
                id=topic.get("id"),
                displayName=topic.get("display_name")
                )

        print(f"Imported {len(topics)} topics.")


        # ----------------------------------------------------
        # WORKS
        # ----------------------------------------------------

        print("\nImporting research works...")

        with driver.session() as session:

            for work in works:

                abstract = ""

                # OpenAlex stores abstracts as an inverted index.
                inverted_index = work.get(
                    "abstract_inverted_index",
                    {}
                )

                if inverted_index:

                    words = []

                    for word, positions in inverted_index.items():

                        for position in positions:

                            words.append(
                                (position, word)
                            )

                    words.sort()

                    abstract = " ".join(
                        word for _, word in words
                    )


                session.run("""
                    MERGE (w:Work {id: $id})

                    SET
                        w.displayName = $displayName,
                        w.abstract = $abstract,
                        w.date = $date,
                        w.language = $language,
                        w.citedByCount = $citedByCount

                """,
                id=work.get("id"),
                displayName=work.get("display_name"),
                abstract=abstract,
                date=work.get("publication_date"),
                language=work.get("language"),
                citedByCount=work.get("cited_by_count", 0)
                )

        print(f"Imported {len(works)} works.")


        # ----------------------------------------------------
        # AUTHOR → WORK RELATIONSHIPS
        # ----------------------------------------------------

        print("\nCreating author-work relationships...")

        relationship_count = 0

        with driver.session() as session:

            for work in works:

                work_id = work.get("id")

                for authorship in work.get(
                    "authorships",
                    []
                ):

                    author = authorship.get(
                        "author",
                        {}
                    )

                    author_id = author.get("id")

                    if not author_id:
                        continue

                    session.run("""
                        MATCH (a:Author {id: $author_id})
                        MATCH (w:Work {id: $work_id})

                        MERGE (w)-[:W_A_E]->(a)

                    """,
                    author_id=author_id,
                    work_id=work_id
                    )

                    relationship_count += 1

        print(
            f"Created {relationship_count} author-work relationships."
        )


        # ----------------------------------------------------
        # WORK → CONCEPT RELATIONSHIPS
        # ----------------------------------------------------

        print("\nCreating work-concept relationships...")

        concept_relationships = 0

        with driver.session() as session:

            for work in works:

                work_id = work.get("id")

                for concept in work.get(
                    "concepts",
                    []
                ):

                    concept_id = concept.get("id")

                    if not concept_id:
                        continue

                    session.run("""
                        MATCH (w:Work {id: $work_id})
                        MATCH (c:Concept {id: $concept_id})

                        MERGE (w)-[:W_C_E]->(c)

                    """,
                    work_id=work_id,
                    concept_id=concept_id
                    )

                    concept_relationships += 1

        print(
            f"Created {concept_relationships} work-concept relationships."
        )


        # ----------------------------------------------------
        # AUTHOR → INSTITUTION RELATIONSHIPS
        # ----------------------------------------------------

        print("\nCreating author-institution relationships...")

        institution_relationships = 0

        with driver.session() as session:

            for author in authors:

                author_id = author.get("id")

                for affiliation in author.get(
                    "affiliations",
                    []
                ):

                    institution = affiliation.get(
                        "institution",
                        {}
                    )

                    institution_id = institution.get(
                        "id"
                    )

                    if not institution_id:
                        continue

                    session.run("""
                        MATCH (a:Author {id: $author_id})
                        MATCH (i:Institution {id: $institution_id})

                        MERGE (a)-[:A_I_E]->(i)

                    """,
                    author_id=author_id,
                    institution_id=institution_id
                    )

                    institution_relationships += 1

        print(
            f"Created {institution_relationships} author-institution relationships."
        )


        # ----------------------------------------------------
        # CREATE FULL TEXT INDEX
        # ----------------------------------------------------

        print("\nCreating full-text search index...")

        with driver.session() as session:

            session.run("""
                CREATE FULLTEXT INDEX papers_search_english IF NOT EXISTS
                FOR (w:Work)
                ON EACH [w.displayName, w.abstract]
            """)

        print("Full-text index created.")


        # ----------------------------------------------------
        # FINISHED
        # ----------------------------------------------------

        print("\n========================================")
        print("IMPORT COMPLETE!")
        print("========================================")

    finally:

        driver.close()


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    import_data()