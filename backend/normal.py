# normal.py

"""
RESEARCHPILOT
Personalized Research Recommendation Engine

ResearchPilot additions:
    1. Knowledge Graph concept matching
    2. Knowledge Graph topic matching (when available)
    3. Research goal matching
    4. Skill matching
    5. Experience-level matching
    6. Personalized recommendation score
    7. Explainable score breakdown

Existing functionality retained:
    - Neo4j full-text search
    - GWO + Hill Climbing optimized weights
    - Interest matching
    - Citation-based scoring
    - User like status
    - Author retrieval
"""

from neo4j import GraphDatabase


def get_group_recommendations(
    group_interests: list,
    driver,
    email=None
):
    """
    Generate personalized ResearchPilot recommendations.

    Parameters
    ----------
    group_interests : list
        Research interests supplied by the user.

    driver : Neo4j driver
        Active Neo4j database driver.

    email : str, optional
        Email of the current user.

    Returns
    -------
    list[dict]
        Personalized research paper recommendations.
    """

    # =========================================================
    # 1. VALIDATE INPUT
    # =========================================================

    if group_interests is None:
        group_interests = []

    group_interests = [
        str(interest).strip()
        for interest in group_interests
        if interest is not None
        and str(interest).strip()
    ]

    print()
    print("=" * 70)
    print("RESEARCHPILOT PERSONALIZED RECOMMENDATION ENGINE")
    print("=" * 70)
    print("User:", email)
    print("Interests:", group_interests)

    # =========================================================
    # 2. EXISTING GWO + HILL CLIMBING WEIGHTS
    #
    # These belong to the OLD recommendation engine.
    #
    # We are REUSING them underneath the new ResearchPilot
    # personalization layer.
    # =========================================================

    OPTIMAL_WEIGHTS = [
        5.0,
        5.5,
        1.7155178134615412
    ]

    w1, w2, w3 = OPTIMAL_WEIGHTS

    print(
        "Existing GWO + Hill Climbing weights:",
        OPTIMAL_WEIGHTS
    )

    # =========================================================
    # 3. RESEARCHPILOT PERSONALIZATION WEIGHTS
    # =========================================================
    #
    # These are NEW ResearchPilot components.
    #
    # Final score:
    #
    # Base score
    # + concept relevance
    # + topic relevance
    # + goal relevance
    # + skill relevance
    # + experience relevance
    #
    # =========================================================

    PERSONALIZATION_WEIGHTS = {

        "concept": 3.0,

        "topic": 3.0,

        "goal": 2.0,

        "skills": 2.0,

        "experience": 1.0
    }

    print(
        "ResearchPilot personalization weights:",
        PERSONALIZATION_WEIGHTS
    )

    # =========================================================
    # 4. QUERY PARAMETERS
    # =========================================================

    query_params = {

        "interests": group_interests,

        "index_name": "papers_search_english",

        # Existing recommendation weights
        "w1": w1,
        "w2": w2,
        "w3": w3,

        # New ResearchPilot weights
        "concept_weight":
            PERSONALIZATION_WEIGHTS["concept"],

        "topic_weight":
            PERSONALIZATION_WEIGHTS["topic"],

        "goal_weight":
            PERSONALIZATION_WEIGHTS["goal"],

        "skills_weight":
            PERSONALIZATION_WEIGHTS["skills"],

        "experience_weight":
            PERSONALIZATION_WEIGHTS["experience"],

        "email": email
    }

    # =========================================================
    # 5. CYPHER QUERY
    # =========================================================

    cypher_query = """

    // =========================================================
    // STEP 1
    // LOAD USER
    // =========================================================

    OPTIONAL MATCH
        (user:User {email: $email})

    WITH
        user,
        $interests AS input_interests

    // =========================================================
    // STEP 2
    // LOAD USER PROFILE
    // =========================================================

    WITH
        user,
        input_interests,

        coalesce(
            user.interests,
            []
        ) AS stored_interests,

        toLower(
            trim(
                coalesce(
                    user.research_goal,
                    ''
                )
            )
        ) AS research_goal,

        toLower(
            trim(
                coalesce(
                    user.experience_level,
                    ''
                )
            )
        ) AS experience_level,

        coalesce(
            user.skills,
            []
        ) AS user_skills

    // =========================================================
    // STEP 3
    // SEARCH PAPERS
    //
    // Existing Neo4j full-text search is retained.
    // =========================================================

    UNWIND input_interests AS interest_query

    CALL db.index.fulltext.queryNodes(
        $index_name,
        interest_query,
        {topK: 500}
    )

    YIELD
        node AS work,
        score

    WHERE
        work.language = 'en'

    // =========================================================
    // STEP 4
    // REMOVE DUPLICATE SEARCH RESULTS
    //
    // A paper can match multiple interests.
    // =========================================================

    WITH
        user,
        input_interests,
        stored_interests,
        research_goal,
        experience_level,
        user_skills,

        work,

        count(
            DISTINCT interest_query
        ) AS interests_matched,

        avg(score) AS avg_relevance

    // =========================================================
    // STEP 5
    // EXISTING BASE SCORE
    //
    // GWO + Hill Climbing optimized score.
    // =========================================================

    WITH
        user,
        input_interests,
        stored_interests,
        research_goal,
        experience_level,
        user_skills,

        work,

        interests_matched,
        avg_relevance,

        (
            avg_relevance * $w1

            +

            interests_matched * $w2

            +

            log10(
                toInteger(
                    coalesce(
                        work.citedByCount,
                        0
                    )
                ) + 1
            ) * $w3

        ) AS base_score

    // =========================================================
    // STEP 6
    // KNOWLEDGE GRAPH CONCEPTS
    //
    // Your current graph DOES have:
    //
    // Work -[:W_C_E]-> Concept
    //
    // So this is the main KG matching mechanism currently.
    // =========================================================

    OPTIONAL MATCH
        (work)-[:W_C_E]->(concept:Concept)

    WITH
        user,
        input_interests,
        stored_interests,
        research_goal,
        experience_level,
        user_skills,

        work,

        interests_matched,
        avg_relevance,
        base_score,

        collect(
            DISTINCT
            toLower(
                trim(
                    coalesce(
                        concept.displayName,
                        concept.name,
                        ''
                    )
                )
            )
        ) AS work_concepts

    // =========================================================
    // STEP 7
    // KNOWLEDGE GRAPH TOPICS
    //
    // We do NOT assume that W_T_E exists.
    //
    // Instead, we look for topics through any relationship
    // from Work to Topic.
    //
    // This keeps the query compatible with the current graph.
    // =========================================================

    OPTIONAL MATCH
        (work)-->(topic:Topic)

    WITH
        user,
        input_interests,
        stored_interests,
        research_goal,
        experience_level,
        user_skills,

        work,

        interests_matched,
        avg_relevance,
        base_score,

        work_concepts,

        collect(
            DISTINCT
            toLower(
                trim(
                    coalesce(
                        topic.displayName,
                        topic.name,
                        ''
                    )
                )
            )
        ) AS work_topics

    // =========================================================
    // STEP 8
    // CONCEPT MATCHING
    //
    // Compare user interests with KG concepts.
    // =========================================================

    WITH
        user,
        input_interests,
        stored_interests,
        research_goal,
        experience_level,
        user_skills,

        work,

        interests_matched,
        avg_relevance,
        base_score,

        work_concepts,
        work_topics,

        size(
            [
                interest IN input_interests

                WHERE
                    any(
                        concept_name IN work_concepts

                        WHERE
                            concept_name <> ''

                            AND

                            (
                                concept_name CONTAINS
                                toLower(
                                    trim(interest)
                                )

                                OR

                                toLower(
                                    trim(interest)
                                ) CONTAINS
                                concept_name
                            )
                    )
            ]
        ) AS concept_matches

    // =========================================================
    // STEP 9
    // TOPIC MATCHING
    // =========================================================

    WITH
        user,
        input_interests,
        stored_interests,
        research_goal,
        experience_level,
        user_skills,

        work,

        interests_matched,
        avg_relevance,
        base_score,

        work_concepts,
        work_topics,

        concept_matches,

        size(
            [
                interest IN input_interests

                WHERE
                    any(
                        topic_name IN work_topics

                        WHERE
                            topic_name <> ''

                            AND

                            (
                                topic_name CONTAINS
                                toLower(
                                    trim(interest)
                                )

                                OR

                                toLower(
                                    trim(interest)
                                ) CONTAINS
                                topic_name
                            )
                    )
            ]
        ) AS topic_matches

    // =========================================================
    // STEP 10
    // CREATE PAPER TEXT
    //
    // Used for goal and skill matching.
    // =========================================================

    WITH
        user,
        input_interests,
        stored_interests,
        research_goal,
        experience_level,
        user_skills,

        work,

        interests_matched,
        avg_relevance,
        base_score,

        work_concepts,
        work_topics,

        concept_matches,
        topic_matches,

        toLower(
            coalesce(
                work.displayName,
                ''
            )

            + ' '

            +

            coalesce(
                work.abstract,
                ''
            )

            + ' '

            +

            reduce(
                concept_text = '',
                c IN work_concepts |
                concept_text + ' ' + c
            )

            + ' '

            +

            reduce(
                topic_text = '',
                t IN work_topics |
                topic_text + ' ' + t
            )

        ) AS paper_text

    // =========================================================
    // STEP 11
    // RESEARCH GOAL MATCHING
    // =========================================================

    WITH
        user,
        input_interests,
        stored_interests,
        research_goal,
        experience_level,
        user_skills,

        work,

        interests_matched,
        avg_relevance,
        base_score,

        work_concepts,
        work_topics,

        concept_matches,
        topic_matches,

        paper_text,

        CASE

            // -------------------------------------------------
            // IDENTIFY RESEARCH GAP
            // -------------------------------------------------

            WHEN
                research_goal IN [
                    'identify_gap',
                    'research_gap',
                    'find_gap'
                ]

                AND

                (
                    paper_text CONTAINS 'gap'

                    OR

                    paper_text CONTAINS 'limitation'

                    OR

                    paper_text CONTAINS 'future work'

                    OR

                    paper_text CONTAINS 'challenge'

                    OR

                    paper_text CONTAINS 'unresolved'

                    OR

                    paper_text CONTAINS 'open problem'
                )

            THEN 1

            // -------------------------------------------------
            // PROJECT / IMPLEMENTATION
            // -------------------------------------------------

            WHEN
                research_goal IN [
                    'project',
                    'build_project',
                    'project_idea',
                    'implementation'
                ]

                AND

                (
                    paper_text CONTAINS 'system'

                    OR

                    paper_text CONTAINS 'framework'

                    OR

                    paper_text CONTAINS 'model'

                    OR

                    paper_text CONTAINS 'application'

                    OR

                    paper_text CONTAINS 'implementation'

                    OR

                    paper_text CONTAINS 'prototype'
                )

            THEN 1

            // -------------------------------------------------
            // LITERATURE REVIEW
            // -------------------------------------------------

            WHEN
                research_goal IN [
                    'literature_review',
                    'literature',
                    'review'
                ]

                AND

                (
                    paper_text CONTAINS 'review'

                    OR

                    paper_text CONTAINS 'survey'

                    OR

                    paper_text CONTAINS 'analysis'

                    OR

                    paper_text CONTAINS 'literature'
                )

            THEN 1

            ELSE 0

        END AS goal_match

    // =========================================================
    // STEP 12
    // SKILL MATCHING
    //
    // Skills are compared against:
    //
    //     - title
    //     - abstract
    //     - concepts
    //     - topics
    //
    // =========================================================

    WITH
        user,
        input_interests,
        stored_interests,
        research_goal,
        experience_level,
        user_skills,

        work,

        interests_matched,
        avg_relevance,
        base_score,

        work_concepts,
        work_topics,

        concept_matches,
        topic_matches,

        goal_match,

        paper_text,

        size(
            [
                skill IN user_skills

                WHERE
                    trim(
                        toString(skill)
                    ) <> ''

                    AND

                    (
                        paper_text CONTAINS
                        toLower(
                            trim(
                                toString(skill)
                            )
                        )

                        OR

                        any(
                            concept_name IN work_concepts

                            WHERE
                                concept_name CONTAINS
                                toLower(
                                    trim(
                                        toString(skill)
                                    )
                                )

                                OR

                                toLower(
                                    trim(
                                        toString(skill)
                                    )
                                ) CONTAINS
                                concept_name
                        )

                        OR

                        any(
                            topic_name IN work_topics

                            WHERE
                                topic_name CONTAINS
                                toLower(
                                    trim(
                                        toString(skill)
                                    )
                                )

                                OR

                                toLower(
                                    trim(
                                        toString(skill)
                                    )
                                ) CONTAINS
                                topic_name
                        )
                    )
            ]
        ) AS skill_matches

    // =========================================================
    // STEP 13
    // EXPERIENCE LEVEL MATCHING
    // =========================================================

    WITH
        user,
        input_interests,
        stored_interests,
        research_goal,
        experience_level,
        user_skills,

        work,

        interests_matched,
        avg_relevance,
        base_score,

        work_concepts,
        work_topics,

        concept_matches,
        topic_matches,

        goal_match,
        skill_matches,

        paper_text,

        CASE

            // -------------------------------------------------
            // BEGINNER
            // -------------------------------------------------

            WHEN
                experience_level IN [
                    'beginner',
                    'novice'
                ]

                AND

                (
                    paper_text CONTAINS 'application'

                    OR

                    paper_text CONTAINS 'system'

                    OR

                    paper_text CONTAINS 'implementation'

                    OR

                    paper_text CONTAINS 'framework'

                    OR

                    paper_text CONTAINS 'practical'

                    OR

                    paper_text CONTAINS 'prototype'
                )

            THEN 1

            // -------------------------------------------------
            // INTERMEDIATE
            // -------------------------------------------------

            WHEN
                experience_level IN [
                    'intermediate',
                    'moderate'
                ]

                AND

                (
                    paper_text CONTAINS 'model'

                    OR

                    paper_text CONTAINS 'method'

                    OR

                    paper_text CONTAINS 'system'

                    OR

                    paper_text CONTAINS 'framework'

                    OR

                    paper_text CONTAINS 'algorithm'
                )

            THEN 1

            // -------------------------------------------------
            // ADVANCED
            // -------------------------------------------------

            WHEN
                experience_level IN [
                    'advanced',
                    'expert'
                ]

                AND

                (
                    paper_text CONTAINS 'novel'

                    OR

                    paper_text CONTAINS 'method'

                    OR

                    paper_text CONTAINS 'theoretical'

                    OR

                    paper_text CONTAINS 'architecture'

                    OR

                    paper_text CONTAINS 'optimization'

                    OR

                    paper_text CONTAINS 'algorithm'
                )

            THEN 1

            ELSE 0

        END AS experience_match

    // =========================================================
    // STEP 14
    // FINAL PERSONALIZED SCORE
    //
    // Existing base score is preserved.
    //
    // ResearchPilot adds:
    //
    //     Concept Match
    //     Topic Match
    //     Goal Match
    //     Skill Match
    //     Experience Match
    //
    // =========================================================

    WITH
        user,
        work,

        interests_matched,
        avg_relevance,
        base_score,

        work_concepts,
        work_topics,

        concept_matches,
        topic_matches,

        goal_match,
        skill_matches,
        experience_match,

        (
            base_score

            +

            (
                concept_matches
                *
                $concept_weight
            )

            +

            (
                topic_matches
                *
                $topic_weight
            )

            +

            (
                goal_match
                *
                $goal_weight
            )

            +

            (
                skill_matches
                *
                $skills_weight
            )

            +

            (
                experience_match
                *
                $experience_weight
            )

        ) AS personalized_score

    // =========================================================
    // STEP 15
    // USER LIKE STATUS
    // =========================================================

    OPTIONAL MATCH
        (user)-[r:U_W_E]->(work)

    // =========================================================
    // STEP 16
    // GET AUTHORS
    // =========================================================

    OPTIONAL MATCH
        (work)-[:W_A_E]->(author:Author)

    // =========================================================
    // STEP 17
    // GROUP AUTHORS
    // =========================================================

    WITH
        work,

        interests_matched,
        avg_relevance,
        base_score,

        work_concepts,
        work_topics,

        concept_matches,
        topic_matches,

        goal_match,
        skill_matches,
        experience_match,

        personalized_score,

        collect(
            DISTINCT
            CASE

                WHEN author IS NOT NULL

                THEN {
                    name:
                        coalesce(
                            author.displayName,
                            author.name,
                            ''
                        ),

                    id:
                        author.id
                }

                ELSE NULL

            END
        ) AS authors,

        CASE

            WHEN count(r) > 0

            THEN true

            ELSE false

        END AS liked

    // =========================================================
    // STEP 18
    // RANK RESULTS
    // =========================================================

    ORDER BY
        personalized_score DESC,
        interests_matched DESC,
        concept_matches DESC,
        topic_matches DESC

    LIMIT 20

    // =========================================================
    // STEP 19
    // RETURN
    // =========================================================

    RETURN

        work.displayName AS title,

        work.id AS id,

        work.date AS date,

        work.abstract AS summary,

        'https://openalex.org/works/' + work.id AS url,

        // Final ResearchPilot score
        personalized_score AS group_score,

        personalized_score,

        // Existing recommendation score
        base_score,

        // Existing relevance
        interests_matched,

        avg_relevance,

        // Knowledge Graph
        concept_matches,

        topic_matches,

        work_concepts,

        work_topics,

        // User personalization
        goal_match,

        skill_matches,

        experience_match,

        // Authors
        authors,

        // Like state
        liked

    """

    # =========================================================
    # 6. EXECUTE QUERY
    # =========================================================

    print()
    print(
        "Running ResearchPilot personalized recommendation query..."
    )

    try:

        records, _, _ = driver.execute_query(
            cypher_query,
            query_params,
            database_="neo4j"
        )

    except Exception as e:

        print()
        print("=" * 70)
        print("RESEARCHPILOT RECOMMENDATION ERROR")
        print("=" * 70)
        print(str(e))
        print("=" * 70)

        raise

    # =========================================================
    # 7. LOG RESULT COUNT
    # =========================================================

    print()
    print(
        "Personalized recommendation records:",
        len(records)
    )

    # =========================================================
    # 8. LOG SCORE BREAKDOWN
    # =========================================================

    if len(records) == 0:

        print()
        print("WARNING: No recommendations were returned.")
        print()
        print("Check:")
        print("1. User interests")
        print("2. Full-text index")
        print("3. Work.language")
        print("4. Work nodes")
        print("5. Search terms")
        print()

    else:

        print()
        print("-" * 70)
        print("RESEARCHPILOT SCORE BREAKDOWN")
        print("-" * 70)

        for i, record in enumerate(
            records,
            start=1
        ):

            print()
            print(
                f"#{i}",
                record.get("title")
            )

            print(
                "  Base score:",
                record.get("base_score")
            )

            print(
                "  Interest matches:",
                record.get("interests_matched")
            )

            print(
                "  Concept matches:",
                record.get("concept_matches")
            )

            print(
                "  Topic matches:",
                record.get("topic_matches")
            )

            print(
                "  Goal match:",
                record.get("goal_match")
            )

            print(
                "  Skill matches:",
                record.get("skill_matches")
            )

            print(
                "  Experience match:",
                record.get("experience_match")
            )

            print(
                "  Personalized score:",
                record.get("personalized_score")
            )

    # =========================================================
    # 9. CONVERT NEO4J RECORDS
    # =========================================================

    recommendations = []

    for record in records:

        recommendation = dict(record)

        # -----------------------------------------------------
        # Remove null authors
        # -----------------------------------------------------

        if "authors" in recommendation:

            recommendation["authors"] = [

                author

                for author in recommendation["authors"]

                if author is not None

            ]

        # -----------------------------------------------------
        # Remove empty KG values if desired by frontend
        #
        # We keep them here because they are useful for
        # debugging and the future ResearchPilot UI.
        # -----------------------------------------------------

        if recommendation.get("work_concepts") is None:

            recommendation["work_concepts"] = []

        if recommendation.get("work_topics") is None:

            recommendation["work_topics"] = []

        recommendations.append(
            recommendation
        )

    # =========================================================
    # 10. RETURN
    # =========================================================

    print()
    print(
        "Returning",
        len(recommendations),
        "ResearchPilot recommendations."
    )

    print("=" * 70)
    print()

    return recommendations