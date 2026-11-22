from flask import Flask, request, jsonify, session as flask_session, send_from_directory, abort
from flask_cors import CORS
import os
import requests
import json
import re
import math
import hmac
import uuid
from functools import lru_cache
from datetime import timedelta
from pathlib import Path

from neo4j import GraphDatabase
from flask_bcrypt import Bcrypt

from normal import get_group_recommendations
from author_recommender import (
    get_similar_authors,
    get_expert_authors
)

from project_ideation import generate_project_ideas

# Faculty registration invitation code
FACULTY_INVITATION_CODE = os.environ.get(
    "FACULTY_INVITATION_CODE",
    ""
)

# ============================================================
# FLASK CONFIGURATION
# ============================================================


app = Flask(__name__)

# ============================================================
# FLASK SESSION CONFIGURATION
# ============================================================

app.secret_key = os.environ.get(
    "FLASK_SECRET_KEY",
    "researchpilot-local-development-only-change-this"
)

app.config.update(
    SESSION_COOKIE_NAME="session",
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False,
    SESSION_COOKIE_PATH="/",
    PERMANENT_SESSION_LIFETIME=timedelta(days=14)
)

# ============================================================
# CORS CONFIGURATION
# ============================================================

CORS(
    app,
    origins=[
        "http://localhost:9002",
        "http://127.0.0.1:9002"
    ],
    supports_credentials=True
)

# ============================================================
# BCRYPT
# ============================================================

bcrypt = Bcrypt(app)



# ============================================================
# NEO4J CONFIGURATION
# ============================================================

URI = "bolt://localhost:7687"

AUTH = (
    "neo4j",
    "Goldfish9"
)


# ============================================================
# OLLAMA CONFIGURATION
# ============================================================

OLLAMA_URL = "http://localhost:11434/api/generate"

OLLAMA_MODEL = "llama3.2:latest"


# ============================================================
# DATABASE DRIVER
# ============================================================

def get_driver():
    """
    Creates a Neo4j driver.
    """

    return GraphDatabase.driver(
        URI,
        auth=AUTH
    )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/", methods=["GET"])
def home():

    return jsonify({
        "status": "running",
        "application": "RESEARCHPILOT",
        "message": "RESEARCHPILOT backend is running"
    }), 200


@app.route("/health", methods=["GET"])
def health():

    try:

        with get_driver() as driver:
            driver.verify_connectivity()

        return jsonify({
            "status": "healthy",
            "neo4j": "connected"
        }), 200

    except Exception as e:

        return jsonify({
            "status": "unhealthy",
            "neo4j": "disconnected",
            "error": str(e)
        }), 500


# ============================================================
# CACHED RECOMMENDATIONS
# ============================================================

@lru_cache(maxsize=128)
def get_cached_recommendations(
    interests_tuple,
    email=None
):

    interests_list = list(interests_tuple)

    print("--- Recommendation cache miss ---")
    print("Interests:", interests_list)
    print("User:", email)

    with get_driver() as driver:

        return get_group_recommendations(
            interests_list,
            driver,
            email
        )


# ============================================================
# RECOMMENDATIONS
# ============================================================

@app.route(
    "/recommendations",
    methods=["POST"]
)
def get_recommendations_endpoint():

    try:

        print()
        print("=" * 60)
        print("RESEARCHPILOT RECOMMENDATIONS")
        print("=" * 60)

        data = request.get_json() or {}

        mode = data.get(
            "mode",
            "individual"
        )

        email = data.get(
            "email"
        )

        print("Mode:", mode)
        print("Email:", email)

        # ====================================================
        # INDIVIDUAL MODE
        # ====================================================

        if mode == "individual":

            interests = data.get(
                "interests",
                []
            )

            institution = data.get(
                "institution",
                ""
            )

            print("Interests:", interests)
            print("Institution:", institution)

            if not interests:

                return jsonify({
                    "error": "No interests provided"
                }), 400

            recommendations = get_cached_recommendations(
                tuple(sorted(interests)),
                email
            )

            return jsonify({
                "recommendations": recommendations
            }), 200

        # ====================================================
        # GROUP MODE
        # ====================================================

        elif mode == "group":

            members = data.get(
                "members",
                []
            )

            if not members:

                return jsonify({
                    "error": "No group members provided"
                }), 400

            all_topics = []
            all_institutions = []

            for member in members:

                topics = member.get(
                    "topics",
                    []
                )

                all_topics.extend(topics)

                institution = member.get(
                    "institution"
                )

                if institution:
                    all_institutions.append(
                        institution
                    )

            if not all_topics:

                return jsonify({
                    "error": "No member topics provided"
                }), 400

            recommendations = get_cached_recommendations(
                tuple(sorted(all_topics)),
                email
            )

            return jsonify({
                "recommendations": recommendations
            }), 200

        else:

            return jsonify({
                "error": "Invalid recommendation mode"
            }), 400

    except Exception as e:

        print("Recommendation error:", e)

        return jsonify({
            "error": "Failed to generate recommendations",
            "details": str(e)
        }), 500


# ============================================================
# HELPER:
# FETCH PAPER FROM NEO4J
# ============================================================

def get_work_from_neo4j(work_id):

    if not work_id:
        return None

    query = """
    MATCH (work:Work {id: $work_id})

    RETURN
        work.id AS id,
        work.displayName AS title,
        work.abstract AS abstract

    LIMIT 1
    """

    try:

        with get_driver() as driver:

            records, _, _ = driver.execute_query(
                query,
                {
                    "work_id": work_id
                },
                database_="neo4j"
            )

        if not records:
            return None

        return dict(records[0])

    except Exception as e:

        print(
            "Neo4j paper lookup error:",
            e
        )

        raise


# ============================================================
# HELPER:
# FETCH USER PROFILE
# ============================================================

def get_user_profile(email):

    if not email:

        return {
            "email": "",
            "interests": [],
            "skills": [],
            "research_goal": "",
            "experience_level": ""
        }

    query = """
    MATCH (user:User {email: $email})

    RETURN
        user.email AS email,

        coalesce(
            user.interests,
            []
        ) AS interests,

        coalesce(
            user.skills,
            []
        ) AS skills,

        coalesce(
            user.research_goal,
            ''
        ) AS research_goal,

        coalesce(
            user.experience_level,
            ''
        ) AS experience_level

    LIMIT 1
    """

    try:

        with get_driver() as driver:

            records, _, _ = driver.execute_query(
                query,
                {
                    "email": email
                },
                database_="neo4j"
            )

        if not records:

            return {
                "email": email,
                "interests": [],
                "skills": [],
                "research_goal": "",
                "experience_level": ""
            }

        return dict(records[0])

    except Exception as e:

        print(
            "User profile lookup error:",
            e
        )

        raise


# ============================================================
# OLLAMA HELPER:
# EXTRACT JSON FROM MODEL RESPONSE
# ============================================================

def extract_json_from_ollama_response(
    response_text
):
    """
    Safely extract JSON from an Ollama response.

    Handles:
      1. Pure JSON
      2. Markdown JSON code blocks
      3. JSON surrounded by explanatory text
    """

    if not isinstance(
        response_text,
        str
    ):
        raise ValueError(
            "Ollama response was not text."
        )

    text = response_text.strip()

    if not text:

        raise ValueError(
            "Ollama returned an empty response."
        )

    # --------------------------------------------------------
    # DIRECT JSON
    # --------------------------------------------------------

    try:

        return json.loads(text)

    except json.JSONDecodeError:
        pass

    # --------------------------------------------------------
    # REMOVE MARKDOWN CODE BLOCK
    # --------------------------------------------------------

    cleaned = re.sub(
        r"^```(?:json)?\s*",
        "",
        text,
        flags=re.IGNORECASE
    )

    cleaned = re.sub(
        r"\s*```$",
        "",
        cleaned
    ).strip()

    try:

        return json.loads(cleaned)

    except json.JSONDecodeError:
        pass

    # --------------------------------------------------------
    # FIND JSON OBJECT
    # --------------------------------------------------------

    object_start = cleaned.find("{")
    object_end = cleaned.rfind("}")

    if (
        object_start != -1
        and object_end != -1
        and object_end > object_start
    ):

        object_text = cleaned[
            object_start:
            object_end + 1
        ]

        try:

            return json.loads(
                object_text
            )

        except json.JSONDecodeError:
            pass

    # --------------------------------------------------------
    # FIND JSON ARRAY
    # --------------------------------------------------------

    array_start = cleaned.find("[")
    array_end = cleaned.rfind("]")

    if (
        array_start != -1
        and array_end != -1
        and array_end > array_start
    ):

        array_text = cleaned[
            array_start:
            array_end + 1
        ]

        try:

            return json.loads(
                array_text
            )

        except json.JSONDecodeError:
            pass

    raise ValueError(
        "Could not parse valid JSON from Ollama response."
    )


# ============================================================
# PROJECT IDEATION HELPER
# ============================================================

def extract_project_ideas(
    result
):
    """
    Normalizes the return value from project_ideation.py.

    The current generate_project_ideas() implementation
    returns a dictionary such as:

    {
        "analysis_status": "ideas_generated",
        "idea_count": 5,
        "paper_count": 3,
        "ideas": [...]
    }

    Older compatibility implementations may return the
    ideas list directly.

    This helper supports both forms.
    """

    # --------------------------------------------------------
    # CURRENT FORMAT:
    # DICTIONARY WITH "ideas"
    # --------------------------------------------------------

    if isinstance(
        result,
        dict
    ):

        ideas = result.get(
            "ideas"
        )

        if not isinstance(
            ideas,
            list
        ):

            raise RuntimeError(
                "Project ideation did not return a valid ideas list."
            )

        return ideas

    # --------------------------------------------------------
    # COMPATIBILITY FORMAT:
    # DIRECT LIST
    # --------------------------------------------------------

    if isinstance(
        result,
        list
    ):

        return result

    raise RuntimeError(
        "Project ideation returned an unexpected response format."
    )


# ============================================================
# PROJECT IDEATION HELPER
# ============================================================

def run_project_ideation(
    *,
    title="",
    abstract="",
    gaps=None,
    papers=None,
    research_gaps_text=None
):
    """
    Calls the current project_ideation.py implementation
    using ONLY parameters that its function accepts.

    IMPORTANT:

    No interests/skills/research_goal/experience_level
    arguments are passed here because the current
    project_ideation.py does not accept them.

    The substantive project ideas are generated entirely
    by the local Ollama model inside project_ideation.py.
    """

    result = generate_project_ideas(
        title=title,
        abstract=abstract,
        gaps=gaps if gaps is not None else "",
        papers=papers,
        research_gaps_text=(
            research_gaps_text
            if research_gaps_text is not None
            else None
        )
    )

    ideas = extract_project_ideas(
        result
    )

    if len(ideas) != 5:

        raise RuntimeError(
            "Project ideation returned "
            f"{len(ideas)} ideas instead of exactly 5."
        )

    return ideas


# ============================================================
# OLLAMA:
# GENERATE RESEARCH GAPS
# ============================================================

def generate_research_gaps_with_llm(
    papers
):
    

    # --------------------------------------------------------
    # VALIDATE INPUT
    # --------------------------------------------------------

    if not isinstance(
        papers,
        list
    ):

        raise ValueError(
            "Papers must be provided as a list."
        )

    usable_papers = []

    for paper in papers:

        if not isinstance(
            paper,
            dict
        ):
            continue

        title = str(
            paper.get(
                "title",
                ""
            )
        ).strip()

        abstract = str(
            paper.get(
                "abstract",
                ""
            )
        ).strip()

        if not abstract:

            abstract = str(
                paper.get(
                    "summary",
                    ""
                )
            ).strip()

        if not abstract:
            continue

        usable_papers.append({
            "id": paper.get("id"),
            "title": title or "Research Paper",
            "abstract": abstract
        })

    # Maximum five papers.
    usable_papers = usable_papers[:5]

    if not usable_papers:

        raise ValueError(
            "No usable research paper abstracts were provided."
        )

    print()
    print("=" * 60)
    print("OLLAMA RESEARCH GAP GENERATION")
    print("=" * 60)

    print(
        "Model:",
        OLLAMA_MODEL
    )

    print(
        "Number of papers:",
        len(usable_papers)
    )

    for index, paper in enumerate(
        usable_papers,
        start=1
    ):

        print(
            f"{index}.",
            paper["title"]
        )

    # --------------------------------------------------------
    # BUILD PAPER INPUT
    # --------------------------------------------------------

    paper_sections = []

    for index, paper in enumerate(
        usable_papers,
        start=1
    ):

        paper_sections.append(
            f"""
PAPER {index}

TITLE:
{paper["title"]}

ABSTRACT:
{paper["abstract"]}
""".strip()
        )

    papers_text = "\n\n".join(
        paper_sections
    )

    # --------------------------------------------------------
    # LLM PROMPT
    # --------------------------------------------------------

    prompt = f"""
You are a research-gap identification system.

Analyze ONLY the following supplied academic research
papers and identify EXACTLY FIVE distinct and meaningful
research gaps.

The research gaps MUST be derived from the actual content
of the supplied papers.

Do not use outside knowledge.

Do not invent facts, datasets, methods, results,
limitations, citations, or claims that are not supported
by the supplied papers.

Do not produce generic filler statements.

Do not simply say:
- more research is needed
- future work is required
- further studies are needed

Instead, identify concrete missing areas, limitations,
unresolved issues, insufficient evaluations, unexplored
applications, methodological weaknesses, dataset
limitations, generalization issues, comparison gaps,
or other meaningful research opportunities supported by
the supplied papers.

You may combine evidence from multiple supplied papers
when doing so reveals a broader research gap.

The five gaps must be DISTINCT from one another.

For every gap provide:

1. gap_id
2. title
3. description
4. evidence
5. research_opportunity
6. category
7. source_papers

The "evidence" field must explain what in the supplied
papers supports the identified gap.

The "source_papers" field must contain the paper numbers
that contributed to that gap.

Return ONLY valid JSON.

The JSON must have exactly this structure:

{{
  "research_gaps": [
    {{
      "gap_id": "GAP_1",
      "title": "...",
      "description": "...",
      "evidence": "...",
      "research_opportunity": "...",
      "category": "...",
      "source_papers": [1]
    }},
    {{
      "gap_id": "GAP_2",
      "title": "...",
      "description": "...",
      "evidence": "...",
      "research_opportunity": "...",
      "category": "...",
      "source_papers": [1, 2]
    }},
    {{
      "gap_id": "GAP_3",
      "title": "...",
      "description": "...",
      "evidence": "...",
      "research_opportunity": "...",
      "category": "...",
      "source_papers": [2]
    }},
    {{
      "gap_id": "GAP_4",
      "title": "...",
      "description": "...",
      "evidence": "...",
      "research_opportunity": "...",
      "category": "...",
      "source_papers": [2, 3]
    }},
    {{
      "gap_id": "GAP_5",
      "title": "...",
      "description": "...",
      "evidence": "...",
      "research_opportunity": "...",
      "category": "...",
      "source_papers": [3]
    }}
  ]
}}

IMPORTANT:

- Generate exactly 5 gaps.
- Do not generate fewer than 5.
- Do not generate more than 5.
- Do not invent information unsupported by the supplied papers.
- Use the actual supplied paper content.
- Make the five gaps meaningfully different.
- If only one supplied paper exists, all five gaps must still be
  grounded in that paper.
- If only two, three, or four supplied papers exist, use only
  those supplied papers.
- Do not pretend that papers were supplied when they were not.

Here are the papers:

{papers_text}
""".strip()

    # --------------------------------------------------------
    # CALL LOCAL OLLAMA
    # --------------------------------------------------------

    print()
    print(
        "Sending papers to local Ollama..."
    )

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        },
        timeout=180
    )

    if response.status_code != 200:

        print(
            "Ollama status:",
            response.status_code
        )

        print(
            "Ollama response:",
            response.text
        )

        raise RuntimeError(
            "Ollama call failed: "
            + response.text
        )

    result = response.json()

    generated_text = (
        result.get(
            "response",
            ""
        )
    )

    if not generated_text:

        raise RuntimeError(
            "Ollama returned no generated research-gap content."
        )

    print(
        "Ollama response received."
    )

    # --------------------------------------------------------
    # PARSE MODEL RESPONSE
    # --------------------------------------------------------

    parsed = extract_json_from_ollama_response(
        generated_text
    )

    # --------------------------------------------------------
    # EXTRACT GAP LIST
    # --------------------------------------------------------

    if isinstance(
        parsed,
        dict
    ):

        gaps = parsed.get(
            "research_gaps"
        )

        if not isinstance(
            gaps,
            list
        ):

            gaps = parsed.get(
                "gaps"
            )

    elif isinstance(
        parsed,
        list
    ):

        gaps = parsed

    else:

        gaps = None

    if not isinstance(
        gaps,
        list
    ):

        raise RuntimeError(
            "Ollama response did not contain a valid "
            "research_gaps list."
        )

    # --------------------------------------------------------
    # VALIDATE GAPS
    # --------------------------------------------------------

    cleaned_gaps = []

    for index, gap in enumerate(
        gaps[:5],
        start=1
    ):

        if not isinstance(
            gap,
            dict
        ):
            continue

        title = str(
            gap.get(
                "title",
                ""
            )
        ).strip()

        description = str(
            gap.get(
                "description",
                ""
            )
        ).strip()

        evidence = str(
            gap.get(
                "evidence",
                ""
            )
        ).strip()

        opportunity = str(
            gap.get(
                "research_opportunity",
                ""
            )
        ).strip()

        category = str(
            gap.get(
                "category",
                ""
            )
        ).strip()

        source_papers = gap.get(
            "source_papers",
            []
        )

        if not isinstance(
            source_papers,
            list
        ):

            source_papers = []

        if not title:
            continue

        if not description:
            continue

        if not evidence:
            continue

        if not opportunity:
            continue

        cleaned_gaps.append({
            "gap_id": (
                gap.get(
                    "gap_id"
                )
                or f"GAP_{index}"
            ),

            "title": title,

            "description":
                description,

            "evidence":
                evidence,

            "research_opportunity":
                opportunity,

            "category":
                category
                or "research_gap",

            "source_papers":
                source_papers
        })

    # --------------------------------------------------------
    # STRICTLY REQUIRE FIVE LLM GAPS
    # --------------------------------------------------------

    if len(cleaned_gaps) != 5:

        raise RuntimeError(
            "The local Llama model returned "
            f"{len(cleaned_gaps)} valid research gaps "
            "instead of exactly 5. No fallback gaps were "
            "generated."
        )

    # Ensure IDs are consistent.
    for index, gap in enumerate(
        cleaned_gaps,
        start=1
    ):

        gap["gap_id"] = (
            f"GAP_{index}"
        )

    print(
        "Valid LLM research gaps:",
        len(cleaned_gaps)
    )

    print("=" * 60)

    return cleaned_gaps


# ============================================================
# SINGLE-PAPER RESEARCH GAP ANALYSIS
#
# LEGACY / COMPATIBILITY ROUTE
# ============================================================

@app.route(
    "/research-gaps",
    methods=["POST"]
)
def research_gaps():

    try:

        data = request.get_json() or {}

        title = str(
            data.get(
                "title",
                ""
            )
        ).strip()

        abstract = str(
            data.get(
                "abstract",
                ""
            )
        ).strip()

        if not title and not abstract:

            return jsonify({
                "error": "Paper title or abstract is required"
            }), 400

        paper = {
            "id": None,
            "title": title,
            "abstract": abstract
        }

        gaps = generate_research_gaps_with_llm(
            [paper]
        )

        return jsonify({
            "analysis_status":
                "gaps_identified",

            "paper_count":
                1,

            "gap_count":
                len(gaps),

            "research_gaps":
                gaps,

            "gaps":
                gaps
        }), 200

    except requests.exceptions.RequestException as e:

        return jsonify({
            "error": "Could not connect to Ollama",
            "details": str(e)
        }), 500

    except Exception as e:

        print()
        print("=" * 60)
        print("RESEARCH GAP API ERROR")
        print("=" * 60)
        print(str(e))
        print("=" * 60)

        return jsonify({
            "error": "Research gap analysis failed",
            "details": str(e)
        }), 500


# ============================================================
# RESEARCH GAP FOR SPECIFIC WORK
# ============================================================

@app.route(
    "/research-gaps/<work_id>",
    methods=["GET"]
)
def research_gaps_for_work(work_id):

    try:

        print()
        print("=" * 60)
        print("RESEARCHPILOT RESEARCH GAP ANALYSIS")
        print("=" * 60)

        print("Work ID:", work_id)

        paper = get_work_from_neo4j(
            work_id
        )

        if paper is None:

            return jsonify({
                "error": "Research paper not found",
                "work_id": work_id
            }), 404

        title = (
            paper.get("title")
            or ""
        )

        abstract = (
            paper.get("abstract")
            or ""
        )

        if not title and not abstract:

            return jsonify({
                "error": "Paper contains no title or abstract",
                "work_id": work_id
            }), 400

        gaps = generate_research_gaps_with_llm(
            [{
                "id": paper.get("id"),
                "title": title,
                "abstract": abstract
            }]
        )

        return jsonify({
            "analysis_status":
                "gaps_identified",

            "paper_count":
                1,

            "gap_count":
                len(gaps),

            "research_gaps":
                gaps,

            "gaps":
                gaps,

            "work_id":
                paper.get("id"),

            "paper_title":
                title
        }), 200

    except requests.exceptions.RequestException as e:

        return jsonify({
            "error": "Could not connect to Ollama",
            "details": str(e),
            "work_id": work_id
        }), 500

    except Exception as e:

        print()
        print("=" * 60)
        print("RESEARCH GAP DATABASE ERROR")
        print("=" * 60)

        print(str(e))

        print("=" * 60)

        return jsonify({
            "error": "Research gap analysis failed",
            "details": str(e),
            "work_id": work_id
        }), 500


# ============================================================
# PROJECT IDEATION
#
# NEW FLOW:
#
# 1. Receive 1-5 papers with usable abstracts.
# 2. Receive research gaps already identified by Ollama.
# 3. DO NOT regenerate research gaps.
# 4. Send papers + gaps to project_ideation.py.
# 5. project_ideation.py calls local Ollama.
# 6. Exactly five project ideas are required.
# ============================================================

@app.route(
    "/project-ideas",
    methods=["POST"]
)
def project_ideas():

    try:

        data = request.get_json(
            silent=True
        ) or {}

        email = (
            data.get("email") or ""
        ).strip()

        papers = data.get(
            "papers"
        )

        research_gaps_data = data.get(
            "research_gaps"
        )

        # ====================================================
        # USER PROFILE DATA
        #
        # Kept for response compatibility.
        # These are NOT passed to generate_project_ideas()
        # because the current function does not accept them.
        # ====================================================

        interests = data.get(
            "interests",
            []
        )

        skills = data.get(
            "skills",
            []
        )

        research_goal = data.get(
            "research_goal",
            ""
        )

        experience_level = data.get(
            "experience_level",
            ""
        )

        # ====================================================
        # NEW MULTI-PAPER FLOW
        # ====================================================

        if isinstance(
            papers,
            list
        ) and len(papers) > 0:

            # ------------------------------------------------
            # VALIDATE PAPERS
            # ------------------------------------------------

            valid_papers = []

            for paper in papers:

                if not isinstance(
                    paper,
                    dict
                ):
                    continue

                title = str(
                    paper.get(
                        "title",
                        ""
                    )
                ).strip()

                abstract = str(
                    paper.get(
                        "summary",
                        paper.get(
                            "abstract",
                            ""
                        )
                    )
                ).strip()

                if not abstract:

                    abstract = str(
                        paper.get(
                            "abstract",
                            ""
                        )
                    ).strip()

                if not title:
                    continue

                if not abstract:
                    continue

                valid_papers.append({
                    "id":
                        paper.get("id"),

                    "title":
                        title,

                    "summary":
                        abstract,

                    "abstract":
                        abstract,

                    "authors":
                        paper.get(
                            "authors",
                            []
                        ),

                    "url":
                        paper.get(
                            "url",
                            ""
                        ),

                    "date":
                        paper.get(
                            "date",
                            ""
                        )
                })

            if not valid_papers:

                return jsonify({
                    "error": (
                        "No papers with usable abstracts "
                        "were provided for project ideation."
                    )
                }), 400

            # Maximum five papers.
            valid_papers = valid_papers[:5]

            # ------------------------------------------------
            # VALIDATE RESEARCH GAPS
            # ------------------------------------------------

            if isinstance(
                research_gaps_data,
                list
            ):

                if not research_gaps_data:

                    return jsonify({
                        "error": (
                            "Research gaps are required "
                            "before generating project ideas."
                        )
                    }), 400

                research_gaps_data = (
                    research_gaps_data[:5]
                )

                research_gaps_text = json.dumps(
                    research_gaps_data,
                    ensure_ascii=False,
                    indent=2
                )

            elif isinstance(
                research_gaps_data,
                dict
            ):

                if isinstance(
                    research_gaps_data.get(
                        "research_gaps"
                    ),
                    list
                ):

                    extracted_gaps = (
                        research_gaps_data.get(
                            "research_gaps"
                        )
                    )

                    if not extracted_gaps:

                        return jsonify({
                            "error": (
                                "Research gaps are required "
                                "before generating project ideas."
                            )
                        }), 400

                    research_gaps_data = (
                        extracted_gaps[:5]
                    )

                    research_gaps_text = json.dumps(
                        research_gaps_data,
                        ensure_ascii=False,
                        indent=2
                    )

                elif isinstance(
                    research_gaps_data.get(
                        "gaps"
                    ),
                    list
                ):

                    extracted_gaps = (
                        research_gaps_data.get(
                            "gaps"
                        )
                    )

                    if not extracted_gaps:

                        return jsonify({
                            "error": (
                                "Research gaps are required "
                                "before generating project ideas."
                            )
                        }), 400

                    research_gaps_data = (
                        extracted_gaps[:5]
                    )

                    research_gaps_text = json.dumps(
                        research_gaps_data,
                        ensure_ascii=False,
                        indent=2
                    )

                else:

                    return jsonify({
                        "error": (
                            "Invalid research-gap structure."
                        )
                    }), 400

            elif isinstance(
                research_gaps_data,
                str
            ):

                research_gaps_text = (
                    research_gaps_data.strip()
                )

                if not research_gaps_text:

                    return jsonify({
                        "error": (
                            "Research gaps are required "
                            "before generating project ideas."
                        )
                    }), 400

            else:

                return jsonify({
                    "error": (
                        "Research gaps are required "
                        "before generating project ideas."
                    )
                }), 400

            # ------------------------------------------------
            # GENERATE PROJECT IDEAS
            #
            # IMPORTANT:
            #
            # DO NOT PASS:
            # interests
            # skills
            # research_goal
            # experience_level
            #
            # The current project_ideation.py does not accept
            # those parameters.
            # ------------------------------------------------

            ideas = run_project_ideation(
                papers=valid_papers,
                research_gaps_text=research_gaps_text
            )

            return jsonify({
                "analysis_status":
                    "ideas_generated",

                "email":
                    email,

                "paper_count":
                    len(valid_papers),

                "papers":
                    valid_papers,

                "research_gaps":
                    research_gaps_data,

                "research_goal":
                    research_goal,

                "experience_level":
                    experience_level,

                "interests":
                    interests,

                "idea_count":
                    len(ideas),

                "ideas":
                    ideas
            }), 200

        # ====================================================
        # OLD SINGLE-PAPER COMPATIBILITY FLOW
        # ====================================================

        work_id = (
            data.get("work_id")
            or data.get("workId")
            or data.get("id")
        )

        title = (
            data.get("title")
            or data.get("paper_title")
            or ""
        )

        abstract = (
            data.get("abstract")
            or data.get("summary")
            or ""
        )

        # ----------------------------------------------------
        # FETCH PAPER FROM NEO4J
        # ----------------------------------------------------

        if work_id:

            paper = get_work_from_neo4j(
                work_id
            )

            if paper:

                title = (
                    paper.get("title")
                    or title
                )

                abstract = (
                    paper.get("abstract")
                    or abstract
                )

        title = str(
            title or ""
        ).strip()

        abstract = str(
            abstract or ""
        ).strip()

        # ----------------------------------------------------
        # VALIDATE
        # ----------------------------------------------------

        if not title:

            return jsonify({
                "error": "A paper title is required."
            }), 400

        if not abstract:

            return jsonify({
                "error": "A usable paper abstract is required."
            }), 400

        # ----------------------------------------------------
        # GENERATE FIVE RESEARCH GAPS USING LOCAL OLLAMA
        # ----------------------------------------------------

        gaps = generate_research_gaps_with_llm(
            [{
                "id": work_id,
                "title": title,
                "abstract": abstract
            }]
        )

        # ----------------------------------------------------
        # GENERATE PROJECT IDEAS USING LOCAL OLLAMA
        # ----------------------------------------------------

        ideas = run_project_ideation(
            title=title,
            abstract=abstract,
            gaps=gaps
        )

        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return jsonify({
            "analysis_status":
                "ideas_generated",

            "email":
                email,

            "work_id":
                work_id,

            "paper": {
                "id":
                    work_id,

                "title":
                    title,

                "abstract":
                    abstract
            },

            "paper_title":
                title,

            "research_goal":
                research_goal,

            "experience_level":
                experience_level,

            "interests":
                interests,

            "gap_count":
                len(gaps),

            "gaps":
                gaps,

            "research_gaps":
                gaps,

            "idea_count":
                len(ideas),

            "ideas":
                ideas
        }), 200

    except requests.exceptions.RequestException as e:

        return jsonify({
            "error": "Could not connect to Ollama",
            "details": str(e)
        }), 500

    except Exception as e:

        print(
            "Project ideas error:",
            repr(e)
        )

        return jsonify({
            "error": "Project idea generation failed",
            "details": str(e)
        }), 500


# ============================================================
# DIRECT PROJECT IDEA GENERATION
#
# /generate-project-ideas
#
# KEPT FOR COMPATIBILITY
# ============================================================

@app.route(
    "/generate-project-ideas",
    methods=["POST"]
)
def generate_project_ideas_endpoint():

    try:

        data = request.get_json() or {}

        title = str(
            data.get(
                "title",
                ""
            )
        ).strip()

        abstract = str(
            data.get(
                "abstract",
                ""
            )
        ).strip()

        gaps = data.get(
            "gaps",
            []
        )

        if not title:

            return jsonify({
                "error": "Paper title is required"
            }), 400

        if not isinstance(
            gaps,
            list
        ):

            return jsonify({
                "error": "Research gaps must be provided as a list"
            }), 400

        if not gaps:

            return jsonify({
                "error": "No research gaps provided"
            }), 400

        # ----------------------------------------------------
        # USER PROFILE VALUES ARE RETAINED FOR COMPATIBILITY
        # BUT ARE NOT PASSED TO PROJECT IDEATION.
        # ----------------------------------------------------

        interests = data.get(
            "interests",
            []
        )

        skills = data.get(
            "skills",
            []
        )

        research_goal = data.get(
            "research_goal",
            ""
        )

        experience_level = data.get(
            "experience_level",
            ""
        )

        # ----------------------------------------------------
        # PROJECT IDEATION
        # ----------------------------------------------------

        ideas = run_project_ideation(
            title=title,
            abstract=abstract,
            gaps=gaps
        )

        return jsonify({
            "analysis_status":
                "ideas_generated",

            "idea_count":
                len(ideas),

            "ideas":
                ideas,

            "research_gaps":
                gaps,

            "interests":
                interests,

            "skills":
                skills,

            "research_goal":
                research_goal,

            "experience_level":
                experience_level
        }), 200

    except requests.exceptions.RequestException as e:

        return jsonify({
            "error": "Could not connect to Ollama",
            "details": str(e)
        }), 500

    except Exception as e:

        print(
            "Project ideation error:",
            e
        )

        return jsonify({
            "error": "Project idea generation failed",
            "details": str(e)
        }), 500


# ============================================================
# COMPLETE PAPER ANALYSIS
#
# POST /analyze-paper
#
# KEPT FOR COMPATIBILITY
# ============================================================

@app.route(
    "/analyze-paper",
    methods=["POST"]
)
def analyze_paper():

    try:

        data = request.get_json() or {}

        title = str(
            data.get(
                "title",
                ""
            )
        ).strip()

        abstract = str(
            data.get(
                "abstract",
                ""
            )
        ).strip()

        interests = data.get(
            "interests",
            []
        )

        skills = data.get(
            "skills",
            []
        )

        research_goal = data.get(
            "research_goal",
            ""
        )

        experience_level = data.get(
            "experience_level",
            ""
        )

        if not title:

            return jsonify({
                "error": "Paper title is required"
            }), 400

        if not abstract:

            return jsonify({
                "error": "A usable paper abstract is required"
            }), 400

        # ====================================================
        # GAP ANALYSIS USING LOCAL OLLAMA
        # ====================================================

        gap_analysis_gaps = (
            generate_research_gaps_with_llm(
                [{
                    "id": None,
                    "title": title,
                    "abstract": abstract
                }]
            )
        )

        # ====================================================
        # PROJECT IDEAS USING LOCAL OLLAMA
        # ====================================================

        ideas = run_project_ideation(
            title=title,
            abstract=abstract,
            gaps=gap_analysis_gaps
        )

        return jsonify({
            "analysis_status":
                "analysis_complete",

            "paper": {
                "title":
                    title,

                "abstract":
                    abstract
            },

            "research_gap_analysis": {
                "status":
                    "gaps_identified",

                "gap_count":
                    len(gap_analysis_gaps),

                "gaps":
                    gap_analysis_gaps,

                "research_gaps":
                    gap_analysis_gaps
            },

            "project_ideation": {
                "idea_count":
                    len(ideas),

                "ideas":
                    ideas
            },

            "user_profile": {
                "interests":
                    interests,

                "skills":
                    skills,

                "research_goal":
                    research_goal,

                "experience_level":
                    experience_level
            }

        }), 200

    except requests.exceptions.RequestException as e:

        return jsonify({
            "error": "Could not connect to Ollama",
            "details": str(e)
        }), 500

    except Exception as e:

        print(
            "Combined paper analysis error:",
            e
        )

        return jsonify({
            "error": "Paper analysis failed",
            "details": str(e)
        }), 500


# ============================================================
# COMPLETE PAPER ANALYSIS BY WORK ID
#
# GET:
# /analyze-paper/<work_id>?email=test@test.com
#
# KEPT FOR COMPATIBILITY
# ============================================================

@app.route(
    "/analyze-paper/<work_id>",
    methods=["GET"]
)
def analyze_paper_by_id(work_id):

    try:

        paper = get_work_from_neo4j(
            work_id
        )

        if paper is None:

            return jsonify({
                "error": "Research paper not found",
                "work_id": work_id
            }), 404

        title = (
            paper.get("title")
            or ""
        )

        abstract = (
            paper.get("abstract")
            or ""
        )

        email = request.args.get(
            "email",
            ""
        ).strip()

        profile = get_user_profile(
            email
        )

        interests = profile.get(
            "interests",
            []
        )

        skills = profile.get(
            "skills",
            []
        )

        research_goal = profile.get(
            "research_goal",
            ""
        )

        experience_level = profile.get(
            "experience_level",
            ""
        )

        if not abstract:

            return jsonify({
                "error": "Paper contains no usable abstract",
                "work_id": work_id
            }), 400

        # ====================================================
        # RESEARCH GAPS
        # ====================================================

        gap_analysis_gaps = (
            generate_research_gaps_with_llm(
                [{
                    "id":
                        paper.get("id"),

                    "title":
                        title,

                    "abstract":
                        abstract
                }]
            )
        )

        # ====================================================
        # PROJECT IDEAS
        # ====================================================

        ideas = run_project_ideation(
            title=title,
            abstract=abstract,
            gaps=gap_analysis_gaps
        )

        return jsonify({
            "analysis_status":
                "analysis_complete",

            "paper": {
                "id":
                    paper.get("id"),

                "title":
                    title,

                "abstract":
                    abstract
            },

            "research_gap_analysis": {
                "status":
                    "gaps_identified",

                "gap_count":
                    len(gap_analysis_gaps),

                "gaps":
                    gap_analysis_gaps,

                "research_gaps":
                    gap_analysis_gaps
            },

            "project_ideation": {
                "idea_count":
                    len(ideas),

                "ideas":
                    ideas
            },

            "user_profile": {
                "email":
                    email,

                "interests":
                    interests,

                "skills":
                    skills,

                "research_goal":
                    research_goal,

                "experience_level":
                    experience_level
            }

        }), 200

    except requests.exceptions.RequestException as e:

        return jsonify({
            "error": "Could not connect to Ollama",
            "details": str(e),
            "work_id": work_id
        }), 500

    except Exception as e:

        print(
            "Paper analysis by ID error:",
            e
        )

        return jsonify({
            "error": "Paper analysis failed",
            "details": str(e),
            "work_id": work_id
        }), 500


# ============================================================
# SIMILAR AUTHORS
# ============================================================

@app.route(
    "/authors/similar",
    methods=["POST"]
)
def recommend_similar_authors():

    try:

        data = request.get_json() or {}

        author_name = data.get(
            "author_name",
            ""
        )

        if not author_name:

            return jsonify({
                "error": "No author_name provided"
            }), 400

        with get_driver() as driver:

            recommendations = get_similar_authors(
                author_name,
                driver
            )

        return jsonify({
            "recommendations":
                recommendations
        }), 200

    except Exception as e:

        return jsonify({
            "error":
                "Failed to recommend similar authors",

            "details":
                str(e)
        }), 500


# ============================================================
# EXPERT AUTHORS
# ============================================================

@app.route(
    "/authors/experts",
    methods=["POST"]
)
def recommend_expert_authors():

    try:

        data = request.get_json() or {}

        institution = data.get(
            "institution",
            ""
        )

        topics = data.get(
            "topics",
            []
        )

        if not topics:

            return jsonify({
                "error": "No topics provided"
            }), 400

        with get_driver() as driver:

            recommendations = get_expert_authors(
                topics,
                institution,
                driver
            )

        return jsonify({
            "recommendations":
                recommendations
        }), 200

    except Exception as e:

        return jsonify({
            "error":
                "Failed to recommend expert authors",

            "details":
                str(e)
        }), 500


# ============================================================
# AUTHOR RECOMMENDATIONS FOR TOPICS
# ============================================================

def get_authors_for_topics(
    topics,
    institutions,
    driver
):

    cypher_query = """
    WITH
        $topics AS inputInterests,
        $institutions AS preferredInstitutions

    UNWIND inputInterests AS inputInterest

    CALL db.index.fulltext.queryNodes(
        "papers_search_english",
        inputInterest,
        {topK: 500}
    )

    YIELD node AS work, score

    MATCH
        (author:Author)<-[:W_A_E]-(work)

    WITH
        author,
        preferredInstitutions,
        collect(
            DISTINCT inputInterest
        ) AS matchedInterestsList

    WITH
        author,
        preferredInstitutions,
        size(
            matchedInterestsList
        ) AS interestsMatched

    OPTIONAL MATCH
        (author)-[:A_I_E]->(inst:Institution)

    WITH
        author,
        interestsMatched,
        preferredInstitutions,
        collect(
            DISTINCT inst.displayName
        ) AS institutions

    WITH
        author,
        interestsMatched,
        institutions,

        CASE
            WHEN any(
                i IN institutions
                WHERE i IN preferredInstitutions
            )
            THEN 100000000
            ELSE 0
        END AS institution_bonus,

        (
            interestsMatched * 50000000
        ) AS consensus_bonus,

        coalesce(
            toInteger(author.hIndex),
            0
        ) AS hIndex,

        coalesce(
            toInteger(author.i10Index),
            0
        ) AS i10Index,

        coalesce(
            toInteger(author.citedByCount),
            0
        ) AS citedByCount

    WITH
        author,
        consensus_bonus,
        institution_bonus,
        hIndex,
        i10Index,
        citedByCount,
        interestsMatched,

        (
            institution_bonus
            + consensus_bonus
            + (hIndex * 100000)
            + (i10Index * 1000)
            + citedByCount
        ) AS final_score

    RETURN
        author.displayName AS name,
        author.id AS id,
        final_score,
        interestsMatched,
        hIndex,
        i10Index,
        citedByCount,

        CASE
            WHEN institution_bonus > 0
            THEN true
            ELSE false
        END AS isPreferred

    ORDER BY
        final_score DESC

    LIMIT 20
    """

    params = {
        "topics": topics,
        "institutions": institutions
    }

    records, _, _ = driver.execute_query(
        cypher_query,
        params,
        database_="neo4j"
    )

    return [
        dict(record)
        for record in records
    ]


# ============================================================
# AUTHOR-TOPIC RECOMMENDATIONS
# ============================================================

@app.route(
    "/author-topic-recommendations",
    methods=["POST"]
)
def author_topic_recommendations():

    try:

        data = request.get_json() or {}

        topics = data.get(
            "topics",
            []
        )

        institutions = data.get(
            "institutions",
            []
        )

        if not topics:

            return jsonify({
                "error": "No topics provided"
            }), 400

        with get_driver() as driver:

            recommendations = get_authors_for_topics(
                topics,
                institutions,
                driver
            )

        return jsonify({
            "recommendations":
                recommendations
        }), 200

    except Exception as e:

        return jsonify({
            "error":
                "Author recommendation failed",

            "details":
                str(e)
        }), 500


# ============================================================
# PROBLEM STATEMENT GENERATION
#
# KEPT FOR COMPATIBILITY
#
# Uses local Ollama only.
# ============================================================

@app.route(
    "/problem-statement",
    methods=["POST"]
)
def problem_statement():

    try:

        data = request.get_json() or {}

        abstracts = data.get(
            "abstracts",
            []
        )

        if not isinstance(
            abstracts,
            list
        ):

            return jsonify({
                "error":
                    "Abstracts must be provided as a list"
            }), 400

        cleaned_abstracts = []

        for abstract in abstracts:

            if not isinstance(
                abstract,
                str
            ):
                continue

            cleaned = abstract.strip()

            if cleaned:
                cleaned_abstracts.append(
                    cleaned
                )

        if not cleaned_abstracts:

            return jsonify({
                "error":
                    "At least one usable abstract is required"
            }), 400

        cleaned_abstracts = (
            cleaned_abstracts[:5]
        )

        prompt = """
You are a research problem statement generation system.

Analyze ONLY the supplied academic abstracts.

Generate clear, specific, and researchable problem
statements grounded in the supplied abstracts.

Do not invent unsupported facts.

Do not use outside information.

Make the problem statements distinct.

Return the result directly.

SUPPLIED ABSTRACTS:

""" + "\n\n".join(
            [
                f"Abstract {i + 1}:\n{ab}"
                for i, ab in enumerate(
                    cleaned_abstracts
                )
            ]
        )

        response = requests.post(
            OLLAMA_URL,
            json={
                "model":
                    OLLAMA_MODEL,

                "prompt":
                    prompt,

                "stream":
                    False
            },
            timeout=120
        )

        if response.status_code != 200:

            return jsonify({
                "error":
                    "Ollama call failed",

                "details":
                    response.text
            }), 500

        result = response.json()

        generated = (
            result.get(
                "response",
                ""
            ).strip()
        )

        if not generated:

            return jsonify({
                "error":
                    "Ollama returned no problem statement."
            }), 500

        return jsonify({
            "problem_statement":
                generated
        }), 200

    except requests.exceptions.RequestException as e:

        return jsonify({
            "error":
                "Could not connect to Ollama",

            "details":
                str(e)
        }), 500

    except Exception as e:

        return jsonify({
            "error":
                "Problem statement generation failed",

            "details":
                str(e)
        }), 500


# ============================================================
# MULTI-PAPER RESEARCH GAP IDENTIFICATION
#
# POST /research-gap
#
# Accepts:
#
# 1 usable paper
# 2 usable papers
# 3 usable papers
# 4 usable papers
# 5 usable papers
#
# If more than five are supplied, only five are used.
#
# EVERY request calls local Ollama.
#
# No deterministic research-gap generation is used.
# ============================================================

@app.route(
    "/research-gap",
    methods=["POST"]
)
def research_gap():

    try:

        print()
        print("=" * 60)
        print("RESEARCHPILOT MULTI-PAPER RESEARCH GAP ANALYSIS")
        print("=" * 60)

        data = request.get_json() or {}

        papers_input = data.get(
            "papers"
        )

        abstracts_input = data.get(
            "abstracts"
        )

        normalized_papers = []

        # ====================================================
        # OPTION 1:
        # COMPLETE PAPERS
        # ====================================================

        if isinstance(
            papers_input,
            list
        ):

            for paper in papers_input:

                if not isinstance(
                    paper,
                    dict
                ):
                    continue

                title = str(
                    paper.get(
                        "title",
                        ""
                    )
                ).strip()

                abstract = str(
                    paper.get(
                        "summary",
                        paper.get(
                            "abstract",
                            ""
                        )
                    )
                ).strip()

                if not abstract:

                    abstract = str(
                        paper.get(
                            "abstract",
                            ""
                        )
                    ).strip()

                if not abstract:
                    continue

                normalized_papers.append({
                    "id":
                        paper.get("id"),

                    "title":
                        title
                        or (
                            f"Research Paper "
                            f"{len(normalized_papers) + 1}"
                        ),

                    "abstract":
                        abstract,

                    "summary":
                        abstract,

                    "authors":
                        paper.get(
                            "authors",
                            []
                        ),

                    "url":
                        paper.get(
                            "url",
                            ""
                        ),

                    "date":
                        paper.get(
                            "date",
                            ""
                        )
                })

        # ====================================================
        # OPTION 2:
        # ABSTRACTS ONLY
        # ====================================================

        elif isinstance(
            abstracts_input,
            list
        ):

            for index, abstract in enumerate(
                abstracts_input
            ):

                if not isinstance(
                    abstract,
                    str
                ):
                    continue

                cleaned_abstract = (
                    abstract.strip()
                )

                if not cleaned_abstract:
                    continue

                normalized_papers.append({
                    "id":
                        None,

                    "title":
                        (
                            f"Research Paper "
                            f"{index + 1}"
                        ),

                    "abstract":
                        cleaned_abstract,

                    "summary":
                        cleaned_abstract,

                    "authors":
                        [],

                    "url":
                        "",

                    "date":
                        ""
                })

        else:

            return jsonify({
                "error": (
                    "Research papers or abstracts "
                    "must be provided as a list."
                )
            }), 400

        # ====================================================
        # REMOVE DUPLICATE PAPERS
        # ====================================================

        unique_papers = []

        seen_ids = set()
        seen_titles = set()

        for paper in normalized_papers:

            paper_id = paper.get(
                "id"
            )

            title_key = (
                paper.get(
                    "title",
                    ""
                )
                .strip()
                .lower()
            )

            if paper_id:

                if paper_id in seen_ids:
                    continue

                seen_ids.add(
                    paper_id
                )

            elif title_key:

                if title_key in seen_titles:
                    continue

                seen_titles.add(
                    title_key
                )

            unique_papers.append(
                paper
            )

        normalized_papers = unique_papers

        # ====================================================
        # REQUIRE AT LEAST ONE
        # ====================================================

        if not normalized_papers:

            return jsonify({
                "error": (
                    "No usable research papers with abstracts "
                    "were provided."
                ),

                "paper_count":
                    0
            }), 400

        # Maximum five.
        normalized_papers = (
            normalized_papers[:5]
        )

        print(
            "Usable papers:",
            len(normalized_papers)
        )

        for index, paper in enumerate(
            normalized_papers,
            start=1
        ):

            print(
                f"{index}.",
                paper.get("title")
            )

            print(
                "   Abstract length:",
                len(
                    paper.get(
                        "abstract",
                        ""
                    )
                )
            )

        # ====================================================
        # ONLY RESEARCH-GAP GENERATION CALL
        # ====================================================

        research_gaps = (
            generate_research_gaps_with_llm(
                normalized_papers
            )
        )

        print(
            "LLM research gaps generated:",
            len(research_gaps)
        )

        print("=" * 60)

        return jsonify({
            "analysis_status":
                "gaps_identified",

            "paper_count":
                len(normalized_papers),

            "papers_analyzed": [
                {
                    "id":
                        paper.get("id"),

                    "title":
                        paper.get("title")
                }

                for paper in normalized_papers
            ],

            "papers":
                normalized_papers,

            "gap_count":
                len(research_gaps),

            "research_gaps":
                research_gaps,

            "gaps":
                research_gaps
        }), 200

    except requests.exceptions.RequestException as e:

        print()
        print("=" * 60)
        print("OLLAMA CONNECTION ERROR")
        print("=" * 60)

        print(
            str(e)
        )

        print("=" * 60)

        return jsonify({
            "error":
                "Could not connect to the local Llama model.",

            "details":
                str(e)
        }), 500

    except Exception as e:

        print()
        print("=" * 60)
        print("RESEARCH GAP GENERATION ERROR")
        print("=" * 60)

        print(
            repr(e)
        )

        print("=" * 60)

        return jsonify({
            "error":
                "Research gap generation failed",

            "details":
                str(e)
        }), 500



# ============================================================
# STUDENT USER SIGNUP
# ============================================================

def signup_user(
    email,
    password_hash,
    interests,
    research_goal,
    experience_level,
    skills,
    driver
):

    # --------------------------------------------------------
    # CREATE A NEW STUDENT USER
    # --------------------------------------------------------

    user_query = """
    CREATE (u:User {
        email: $email,
        password_hash: $passwordHash,
        role: 'student',
        created_at: datetime(),
        interests: $interests,
        research_goal: $researchGoal,
        experience_level: $experienceLevel,
        skills: $skills
    })

    RETURN
        u.email AS email,
        u.interests AS interests,
        u.research_goal AS research_goal,
        u.experience_level AS experience_level,
        u.skills AS skills,
        u.role AS role
    """

    result = driver.execute_query(
        user_query,
        {
            "email": email,
            "passwordHash": password_hash,
            "interests": interests,
            "researchGoal": research_goal,
            "experienceLevel": experience_level,
            "skills": skills
        },
        database_="neo4j"
    )

    # --------------------------------------------------------
    # CREATE STUDENT INTEREST RELATIONSHIPS
    # --------------------------------------------------------

    relationship_query = """
    MATCH (u:User {email: $email})

    UNWIND $interests AS inputInterest

    WITH
        u,
        trim(inputInterest) AS originalInterest,

        CASE
            WHEN toLower(trim(inputInterest)) = 'ai'
                THEN 'artificial intelligence'

            WHEN toLower(trim(inputInterest)) = 'ml'
                THEN 'machine learning'

            WHEN toLower(trim(inputInterest)) = 'dl'
                THEN 'deep learning'

            WHEN toLower(trim(inputInterest)) = 'nlp'
                THEN 'natural language processing'

            WHEN toLower(trim(inputInterest)) = 'cv'
                THEN 'computer vision'

            ELSE toLower(trim(inputInterest))
        END AS normalizedInterest

    MATCH (interestNode)

    WHERE
        (
            interestNode:Concept
            OR interestNode:Topic
            OR interestNode:Keyword
        )

        AND interestNode.displayName IS NOT NULL

        AND (
            toLower(interestNode.displayName)
                CONTAINS normalizedInterest

            OR normalizedInterest
                CONTAINS toLower(interestNode.displayName)
        )

    MERGE (u)-[:U_I_E]->(interestNode)

    RETURN
        count(DISTINCT interestNode) AS linksCreated
    """

    relationship_result = driver.execute_query(
        relationship_query,
        {
            "email": email,
            "interests": interests
        },
        database_="neo4j"
    )

    links_created = 0

    if relationship_result[0]:
        links_created = relationship_result[0][0]["linksCreated"]

    return [{
        "UserEmail": email,
        "LinksCreated": links_created
    }]




# ============================================================
# STUDENT SIGNUP
# ============================================================

@app.route("/signup", methods=["POST"])
def signup():

    try:

        # ====================================================
        # READ REQUEST DATA
        # ====================================================

        data = request.get_json(silent=True) or {}

        email = data.get("email")
        password = data.get("password")

        interests = data.get("interests", [])
        research_goal = data.get("research_goal", "")
        experience_level = data.get("experience_level", "")
        skills = data.get("skills", [])

        # ====================================================
        # VALIDATE EMAIL AND PASSWORD
        # ====================================================

        if (
            not isinstance(email, str)
            or not email.strip()
        ):
            return jsonify({
                "error": "Please provide a valid email address"
            }), 400

        if (
            not isinstance(password, str)
            or not password
        ):
            return jsonify({
                "error": "Please provide a valid password"
            }), 400

        cleaned_email = email.strip().lower()

        if (
            "@" not in cleaned_email
            or cleaned_email.startswith("@")
            or cleaned_email.endswith("@")
        ):
            return jsonify({
                "error": "Please provide a valid email address"
            }), 400

        # ====================================================
        # VALIDATE INTERESTS
        # ====================================================

        if not isinstance(interests, list):

            return jsonify({
                "error": "Interests must be a list"
            }), 400

        if not interests:

            return jsonify({
                "error": "Please add at least one research interest"
            }), 400

        # ====================================================
        # VALIDATE RESEARCH GOAL
        # ====================================================

        if (
            not isinstance(research_goal, str)
            or not research_goal.strip()
        ):

            return jsonify({
                "error": "Please provide a research goal"
            }), 400

        # ====================================================
        # VALIDATE EXPERIENCE LEVEL
        # ====================================================

        if (
            not isinstance(experience_level, str)
            or not experience_level.strip()
        ):

            return jsonify({
                "error": "Please provide a research experience level"
            }), 400

        # ====================================================
        # VALIDATE SKILLS
        # ====================================================

        if skills is None:
            skills = []

        if not isinstance(skills, list):

            return jsonify({
                "error": "Skills must be a list"
            }), 400

        # ====================================================
        # CLEAN INTERESTS
        # ====================================================

        cleaned_interests = []
        seen_interests = set()

        for interest in interests:

            if isinstance(interest, str):

                cleaned = interest.strip()

                normalized = cleaned.lower()

                if (
                    cleaned
                    and normalized not in seen_interests
                ):

                    cleaned_interests.append(cleaned)
                    seen_interests.add(normalized)

        if not cleaned_interests:

            return jsonify({
                "error": (
                    "Please add at least one valid "
                    "research interest"
                )
            }), 400

        # ====================================================
        # CLEAN SKILLS
        # ====================================================

        cleaned_skills = []
        seen_skills = set()

        for skill in skills:

            if isinstance(skill, str):

                cleaned = skill.strip()

                normalized = cleaned.lower()

                if (
                    cleaned
                    and normalized not in seen_skills
                ):

                    cleaned_skills.append(cleaned)
                    seen_skills.add(normalized)

        # ====================================================
        # CLEAN OTHER FIELDS
        # ====================================================

        cleaned_research_goal = research_goal.strip()

        cleaned_experience_level = experience_level.strip()

        # ====================================================
        # CHECK FOR EXISTING STUDENT ACCOUNT
        # ====================================================

        with get_driver() as driver:

            with driver.session() as session:

                existing_user = session.run(
                    """
                    MATCH (u:User {email: $email})
                    RETURN u.email AS email
                    LIMIT 1
                    """,
                    email=cleaned_email
                ).single()

                if existing_user:

                    return jsonify({
                        "error": (
                            "An account with this email "
                            "already exists. Please log in."
                        )
                    }), 409

            # ====================================================
            # HASH PASSWORD
            # ====================================================

            password_hash = (
                bcrypt.generate_password_hash(
                    password
                ).decode("utf-8")
            )

            # ====================================================
            # CREATE STUDENT ACCOUNT
            # ====================================================

            result = signup_user(
                cleaned_email,
                password_hash,
                cleaned_interests,
                cleaned_research_goal,
                cleaned_experience_level,
                cleaned_skills,
                driver
            )

            # ====================================================
            # SET STUDENT ROLE
            # ====================================================

            with driver.session() as session:

                session.run(
                    """
                    MATCH (u:User {email: $email})
                    SET u.role = 'student'
                    """,
                    email=cleaned_email
                )

        # ====================================================
        # CREATE STUDENT SESSION
        # ====================================================

        flask_session.clear()

        flask_session["user_email"] = cleaned_email
        flask_session["user_role"] = "student"
        flask_session.permanent = True

        # ====================================================
        # SUCCESS RESPONSE
        # ====================================================

        return jsonify({
            "message": "Student registration successful",
            "email": cleaned_email,
            "role": "student"
        }), 201

    except Exception as e:

        app.logger.exception("Student signup route failed")

        return jsonify({
            "error": "Signup failed",
            "details": str(e)
        }), 500


# ============================================================
# FACULTY SIGNUP
# ============================================================

@app.route("/faculty/signup", methods=["POST"])
def faculty_signup():

    try:

        data = request.get_json() or {}

        faculty_id = data.get("faculty_id")
        email = data.get("email")
        password = data.get("password")
        invitation_code = data.get("invitation_code")

        # ----------------------------------------------------
        # VALIDATION
        # ----------------------------------------------------

        if not all([faculty_id, email, password, invitation_code]):

            return jsonify({
                "error": "All fields are required"
            }), 400

        if not all(isinstance(value, str) for value in [
            faculty_id, email, password, invitation_code
        ]):

            return jsonify({
                "error": "Invalid registration details"
            }), 400

        faculty_id = faculty_id.strip()
        cleaned_email = email.strip().lower()

        if not faculty_id or not cleaned_email:

            return jsonify({
                "error": "Faculty ID and email are required"
            }), 400

        if not re.match(
            r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
            cleaned_email
        ):

            return jsonify({
                "error": "Please enter a valid email address"
            }), 400

        if len(password) < 8:

            return jsonify({
                "error": "Password must contain at least 8 characters"
            }), 400

        # ----------------------------------------------------
        # INVITATION CODE VALIDATION
        # ----------------------------------------------------

        configured_code = app.config.get(
            "FACULTY_INVITATION_CODE"
        ) or os.environ.get("FACULTY_INVITATION_CODE", "")

        if not configured_code:

            app.logger.error(
                "Faculty registration is disabled: invitation code not configured"
            )

            return jsonify({
                "error": "Faculty registration is currently unavailable"
            }), 503

        if not hmac.compare_digest(
            invitation_code,
            configured_code
        ):

            return jsonify({
                "error": "Invalid faculty invitation code"
            }), 403

        # ----------------------------------------------------
        # VERIFY FACULTY PROFILE AND CREATE ACCOUNT
        # ----------------------------------------------------

        password_hash = bcrypt.generate_password_hash(
            password
        ).decode("utf-8")

        with get_driver() as driver:

            with driver.session(database="neo4j") as db_session:

                # Check whether the faculty profile exists.
                faculty_query = """
                MATCH (f:Faculty {faculty_id: $faculty_id})

                RETURN
                    f.faculty_id AS faculty_id,
                    f.name AS name
                """

                faculty_result = db_session.run(
                    faculty_query,
                    faculty_id=faculty_id
                ).single()

                if not faculty_result:

                    return jsonify({
                        "error": "Faculty profile not found"
                    }), 404

                # Check for existing email or faculty ID.
                existing_query = """
                MATCH (fa:FacultyAccount)

                WHERE
                    fa.email = $email
                    OR fa.faculty_id = $faculty_id

                RETURN fa.email AS email
                LIMIT 1
                """

                existing_result = db_session.run(
                    existing_query,
                    email=cleaned_email,
                    faculty_id=faculty_id
                ).single()

                if existing_result:

                    return jsonify({
                        "error": "An account already exists for this email or faculty ID"
                    }), 409

                # Create a separate faculty account.
                create_query = """
                MATCH (f:Faculty {faculty_id: $faculty_id})

                CREATE (fa:FacultyAccount {
                    email: $email,
                    password_hash: $password_hash,
                    faculty_id: $faculty_id,
                    role: 'faculty',
                    created_at: datetime()
                })

                CREATE (fa)-[:BELONGS_TO]->(f)

                RETURN
                    fa.email AS email,
                    fa.faculty_id AS faculty_id,
                    f.name AS name
                """

                create_result = db_session.run(
                    create_query,
                    email=cleaned_email,
                    password_hash=password_hash,
                    faculty_id=faculty_id
                ).single()

                if not create_result:

                    return jsonify({
                        "error": "Faculty registration failed"
                    }), 500

        # ----------------------------------------------------
        # CREATE FACULTY SESSION
        # ----------------------------------------------------

        flask_session.clear()

        flask_session["user_email"] = cleaned_email
        flask_session["user_role"] = "faculty"
        flask_session["faculty_id"] = faculty_id

        flask_session.permanent = True

        return jsonify({
            "message": "Faculty registration successful",
            "email": cleaned_email,
            "faculty_id": faculty_id,
            "name": create_result["name"],
            "role": "faculty"
        }), 201

    except Exception:

        app.logger.exception("Faculty signup failed")

        return jsonify({
            "error": "Faculty registration failed"
        }), 500


# ============================================================
# FACULTY LOGIN
# ============================================================

@app.route("/faculty/login", methods=["POST"])
def faculty_login():

    try:

        data = request.get_json() or {}

        email = data.get("email")
        password = data.get("password")

        # ----------------------------------------------------
        # VALIDATION
        # ----------------------------------------------------

        if not email or not password:

            return jsonify({
                "error": "Missing email or password"
            }), 400

        if not isinstance(email, str) or not isinstance(password, str):

            return jsonify({
                "error": "Invalid email or password"
            }), 400

        cleaned_email = email.strip().lower()

        if not cleaned_email:

            return jsonify({
                "error": "Missing email or password"
            }), 400

        # ----------------------------------------------------
        # FIND FACULTY ACCOUNT
        # ----------------------------------------------------

        with get_driver() as driver:

            with driver.session(database="neo4j") as db_session:

                query = """
                MATCH
                    (fa:FacultyAccount {email: $email})
                    -[:BELONGS_TO]->
                    (f:Faculty)

                RETURN
                    fa.password_hash AS password_hash,
                    fa.faculty_id AS faculty_id,
                    f.name AS name,
                    fa.role AS role
                """

                result = db_session.run(
                    query,
                    email=cleaned_email
                ).single()

                if not result:

                    return jsonify({
                        "error": "Invalid email or password"
                    }), 401

                password_hash = result["password_hash"]

                if not password_hash or not bcrypt.check_password_hash(
                    password_hash,
                    password
                ):

                    return jsonify({
                        "error": "Invalid email or password"
                    }), 401

                if result["role"] != "faculty":

                    return jsonify({
                        "error": "Invalid faculty account"
                    }), 403

                faculty_id = result["faculty_id"]
                faculty_name = result["name"]

        # ----------------------------------------------------
        # CREATE FACULTY SESSION
        # ----------------------------------------------------

        flask_session.clear()

        flask_session["user_email"] = cleaned_email
        flask_session["user_role"] = "faculty"
        flask_session["faculty_id"] = faculty_id

        flask_session.permanent = True

        return jsonify({
            "message": "Faculty login successful",
            "email": cleaned_email,
            "faculty_id": faculty_id,
            "name": faculty_name,
            "role": "faculty"
        }), 200

    except Exception:

        app.logger.exception("Faculty login failed")

        return jsonify({
            "error": "Faculty login failed"
        }), 500



# ============================================================
# FACULTY DASHBOARD
# ============================================================

@app.route("/faculty/dashboard", methods=["GET"])
def faculty_dashboard():

    try:
        # ----------------------------------------------------
        # AUTHENTICATION
        # ----------------------------------------------------

        if not flask_session.get("user_email"):
            return jsonify({"error": "Authentication required"}), 401

        if flask_session.get("user_role") != "faculty":
            return jsonify({"error": "Faculty access required"}), 403

        email = flask_session["user_email"]
        faculty_id = flask_session.get("faculty_id")

        if not faculty_id:
            return jsonify({"error": "Faculty session is invalid"}), 401

        # ----------------------------------------------------
        # FETCH FACULTY PROFILE AND PUBLICATIONS
        # ----------------------------------------------------

        with get_driver() as driver:
            with driver.session(database="neo4j") as db_session:

                query = """
                MATCH
                    (fa:FacultyAccount {email: $email})
                    -[:BELONGS_TO]->
                    (f:Faculty {faculty_id: $faculty_id})

                OPTIONAL MATCH
                    (f)-[:HAS_RESEARCH_AREA]->(ra:ResearchArea)

                WITH
                    f,
                    collect(DISTINCT
                        CASE
                            WHEN ra IS NULL THEN NULL
                            ELSE coalesce(ra.displayName, ra.name)
                        END
                    ) AS research_areas

                OPTIONAL MATCH
                    (f)-[:HAS_PUBLICATION]->(fp:FacultyPublication)

                RETURN
                    f.faculty_id AS faculty_id,
                    f.name AS name,
                    f.honorific AS honorific,
                    f.department AS department,
                    f.campus AS campus,
                    f.designation AS designation,
                    f.photo_url AS photo_url,
                    f.profile_url AS profile_url,
                    research_areas,
                    collect(DISTINCT
                        CASE
                            WHEN fp IS NULL THEN NULL
                            ELSE properties(fp)
                        END
                    ) AS publications
                """

                result = db_session.run(
                    query,
                    email=email,
                    faculty_id=faculty_id
                ).single()

                if not result:
                    return jsonify({
                        "error": "Faculty profile not found"
                    }), 404

        # ----------------------------------------------------
        # FORMAT RESEARCH AREAS
        # ----------------------------------------------------

        research_areas = [
            area
            for area in (result["research_areas"] or [])
            if area
        ]

        # ----------------------------------------------------
        # FORMAT PUBLICATIONS
        # ----------------------------------------------------

        publications = []

        for publication in (result["publications"] or []):

            if not publication:
                continue

            # The importer creates scraped publications with
            # source_text, data_source, profile_url and
            # verification_status.
            #
            # New faculty-created records have source =
            # "faculty_added" and is_scraped = False.

            is_scraped = (
                publication.get("is_scraped") is True
                or (
                    publication.get("source") != "faculty_added"
                    and (
                        bool(publication.get("source_text"))
                        or bool(publication.get("data_source"))
                        or publication.get("verification_status")
                        == "unverified_candidate"
                    )
                )
            )

            # Use edited values when available. Original scraped
            # properties remain unchanged in the database.

            title = (
                publication.get("edited_title")
                or publication.get("title")
                or publication.get("publication_title")
                or publication.get("name")
                or "Untitled publication"
            )

            year = (
                publication.get("edited_year")
                if publication.get("edited_year") is not None
                else publication.get("year")
                or publication.get("publication_year")
            )

            doi = (
                publication.get("edited_doi")
                if publication.get("edited_doi") is not None
                else publication.get("doi", "")
            )

            url = (
                publication.get("edited_url")
                if publication.get("edited_url") is not None
                else (
                    publication.get("url")
                    or publication.get("publication_url")
                    or ""
                )
            )

            publication_type = (
                publication.get("edited_publication_type")
                or publication.get("publication_type")
                or publication.get("type")
                or ""
            )

            publications.append({
                "publication_id": publication.get("publication_id"),
                "title": title,
                "year": year,
                "doi": doi or "",
                "url": url or "",
                "publication_type": publication_type or "",
                "source": "scraped" if is_scraped else "faculty_added",
                "is_scraped": is_scraped
            })

        # ----------------------------------------------------
        # BUILD RESPONSE
        # ----------------------------------------------------

        faculty_data = {
            "faculty_id": result["faculty_id"],
            "name": result["name"] or "",
            "honorific": result["honorific"] or "",
            "department": result["department"] or "",
            "campus": result["campus"] or "",
            "designation": result["designation"] or "",
            "photo_url": result["photo_url"] or "",
            "profile_url": result["profile_url"] or "",
            "research_areas": research_areas,
            "publications": publications
        }

        return jsonify({
            "faculty": faculty_data
        }), 200

    except Exception:
        app.logger.exception("Faculty dashboard failed")

        return jsonify({
            "error": "Unable to load faculty dashboard"
        }), 500

# ============================================================
# PUBLICATION VALIDATION HELPER
# ============================================================

def validate_faculty_publication(data):

    if not isinstance(data, dict):
        return None, "Invalid publication data"

    title = data.get("title")
    year = data.get("year")
    doi = data.get("doi", "")
    url = data.get("url", "")
    publication_type = data.get("publication_type", "Other")

    # --------------------------------------------------------
    # TITLE
    # --------------------------------------------------------

    if not isinstance(title, str):
        return None, "Publication title is required"

    title = title.strip()

    if not title:
        return None, "Publication title is required"

    if len(title) > 500:
        return None, "Publication title cannot exceed 500 characters"

    # --------------------------------------------------------
    # YEAR
    # --------------------------------------------------------

    if year == "":
        year = None

    if year is not None:

        if isinstance(year, bool):
            return None, "Invalid publication year"

        try:
            parsed_year = int(year)
        except (ValueError, TypeError):
            return None, "Invalid publication year"

        if (
            parsed_year < 1000
            or parsed_year > __import__("datetime").datetime.now().year + 1
        ):
            return None, "Please enter a valid publication year"

        year = parsed_year

    # --------------------------------------------------------
    # DOI
    # --------------------------------------------------------

    if not isinstance(doi, str):
        return None, "Invalid DOI"

    doi = doi.strip()

    if len(doi) > 300:
        return None, "DOI cannot exceed 300 characters"

    # --------------------------------------------------------
    # URL
    # --------------------------------------------------------

    if not isinstance(url, str):
        return None, "Invalid publication URL"

    url = url.strip()

    if len(url) > 2048:
        return None, "Publication URL is too long"

    if url and not re.match(
        r"^https?://",
        url,
        re.IGNORECASE
    ):
        return None, "Publication URL must begin with http:// or https://"

    # --------------------------------------------------------
    # PUBLICATION TYPE
    # --------------------------------------------------------

    allowed_types = {
        "Journal Article",
        "Conference Paper",
        "Book",
        "Book Chapter",
        "Review Article",
        "Preprint",
        "Thesis",
        "Other"
    }

    if not isinstance(publication_type, str):
        return None, "Invalid publication type"

    publication_type = publication_type.strip()

    if publication_type not in allowed_types:
        return None, "Invalid publication type"

    return {
        "title": title,
        "year": year,
        "doi": doi,
        "url": url,
        "publication_type": publication_type
    }, None


# ============================================================
# ADD FACULTY PUBLICATION
# ============================================================

@app.route("/faculty/publications", methods=["POST"])
def add_faculty_publication():

    try:
        # ----------------------------------------------------
        # AUTHENTICATION
        # ----------------------------------------------------

        if not flask_session.get("user_email"):
            return jsonify({"error": "Authentication required"}), 401

        if flask_session.get("user_role") != "faculty":
            return jsonify({"error": "Faculty access required"}), 403

        email = flask_session["user_email"]
        faculty_id = flask_session.get("faculty_id")

        if not faculty_id:
            return jsonify({"error": "Faculty session is invalid"}), 401

        # ----------------------------------------------------
        # VALIDATE REQUEST
        # ----------------------------------------------------

        data = request.get_json(silent=True)

        publication_data, validation_error = validate_faculty_publication(
            data
        )

        if validation_error:
            return jsonify({"error": validation_error}), 400

        # ----------------------------------------------------
        # GENERATE PUBLICATION ID
        # ----------------------------------------------------

        publication_id = str(uuid.uuid4())

        # ----------------------------------------------------
        # CREATE PUBLICATION
        # ----------------------------------------------------

        with get_driver() as driver:
            with driver.session(database="neo4j") as db_session:

                query = """
                MATCH
                    (fa:FacultyAccount {email: $email})
                    -[:BELONGS_TO]->
                    (f:Faculty {faculty_id: $faculty_id})

                CREATE (fp:FacultyPublication {
                    publication_id: $publication_id,
                    title: $title,
                    year: $year,
                    doi: $doi,
                    url: $url,
                    publication_type: $publication_type,
                    source: 'faculty_added',
                    is_scraped: false,
                    created_at: datetime(),
                    updated_at: datetime()
                })

                CREATE (f)-[:HAS_PUBLICATION]->(fp)

                RETURN fp.publication_id AS publication_id
                """

                result = db_session.run(
                    query,
                    email=email,
                    faculty_id=faculty_id,
                    publication_id=publication_id,
                    title=publication_data["title"],
                    year=publication_data["year"],
                    doi=publication_data["doi"],
                    url=publication_data["url"],
                    publication_type=publication_data["publication_type"]
                ).single()

                if not result:
                    return jsonify({
                        "error": "Faculty account or profile not found"
                    }), 404

        return jsonify({
            "message": "Publication added successfully",
            "publication_id": publication_id
        }), 201

    except Exception:
        app.logger.exception("Adding faculty publication failed")

        return jsonify({
            "error": "Unable to add publication"
        }), 500


# ============================================================
# EDIT FACULTY PUBLICATION
# ============================================================

@app.route(
    "/faculty/publications/<publication_id>",
    methods=["PUT"]
)
def update_faculty_publication(publication_id):

    try:
        # ----------------------------------------------------
        # AUTHENTICATION
        # ----------------------------------------------------

        if not flask_session.get("user_email"):
            return jsonify({"error": "Authentication required"}), 401

        if flask_session.get("user_role") != "faculty":
            return jsonify({"error": "Faculty access required"}), 403

        email = flask_session["user_email"]
        faculty_id = flask_session.get("faculty_id")

        if not faculty_id:
            return jsonify({"error": "Faculty session is invalid"}), 401

        if not publication_id or len(publication_id) > 200:
            return jsonify({"error": "Invalid publication ID"}), 400

        # ----------------------------------------------------
        # VALIDATE REQUEST
        # ----------------------------------------------------

        data = request.get_json(silent=True)

        publication_data, validation_error = validate_faculty_publication(
            data
        )

        if validation_error:
            return jsonify({"error": validation_error}), 400

        # ----------------------------------------------------
        # UPDATE PUBLICATION
        # ----------------------------------------------------

        with get_driver() as driver:
            with driver.session(database="neo4j") as db_session:

                query = """
                MATCH
                    (fa:FacultyAccount {email: $email})
                    -[:BELONGS_TO]->
                    (f:Faculty {faculty_id: $faculty_id})
                    -[:HAS_PUBLICATION]->
                    (fp:FacultyPublication {
                        publication_id: $publication_id
                    })

                // Store edits separately from the original properties.
                // This preserves imported publication data and prevents
                // the faculty editor from overwriting the scraper fields.

                SET
                    fp.edited_title = $title,
                    fp.edited_year = $year,
                    fp.edited_doi = $doi,
                    fp.edited_url = $url,
                    fp.edited_publication_type = $publication_type,
                    fp.updated_at = datetime()

                RETURN fp.publication_id AS publication_id
                """

                result = db_session.run(
                    query,
                    email=email,
                    faculty_id=faculty_id,
                    publication_id=publication_id,
                    title=publication_data["title"],
                    year=publication_data["year"],
                    doi=publication_data["doi"],
                    url=publication_data["url"],
                    publication_type=publication_data["publication_type"]
                ).single()

                if not result:
                    return jsonify({
                        "error": "Publication not found or you do not have permission to edit it"
                    }), 404

        return jsonify({
            "message": "Publication updated successfully",
            "publication_id": publication_id
        }), 200

    except Exception:
        app.logger.exception("Updating faculty publication failed")

        return jsonify({
            "error": "Unable to update publication"
        }), 500
    
# ============================================================
# UPDATE FACULTY RESEARCH PROFILE
# ============================================================

@app.route("/faculty/profile", methods=["PUT"])
def update_faculty_profile():

    try:

        # ----------------------------------------------------
        # AUTHENTICATION CHECK
        # ----------------------------------------------------

        if not flask_session.get("user_email"):
            return jsonify({
                "error": "Authentication required"
            }), 401

        if flask_session.get("user_role") != "faculty":
            return jsonify({
                "error": "Faculty access required"
            }), 403

        email = flask_session["user_email"]
        faculty_id = flask_session.get("faculty_id")

        if not faculty_id:
            return jsonify({
                "error": "Faculty session is invalid"
            }), 401

        # ----------------------------------------------------
        # READ REQUEST DATA
        # ----------------------------------------------------

        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "error": "Invalid request data"
            }), 400

        honorific = data.get("honorific", "")
        designation = data.get("designation", "")
        research_areas = data.get("research_areas", [])
        photo_url = data.get("photo_url", "")
        profile_url = data.get("profile_url", "")

        # ----------------------------------------------------
        # VALIDATE INPUT TYPES
        # ----------------------------------------------------

        if not all(
            isinstance(value, str)
            for value in [
                honorific,
                designation,
                photo_url,
                profile_url
            ]
        ):
            return jsonify({
                "error": "Invalid profile information"
            }), 400

        if not isinstance(research_areas, list):
            return jsonify({
                "error": "Research areas must be provided as a list"
            }), 400

        if not all(
            isinstance(area, str)
            for area in research_areas
        ):
            return jsonify({
                "error": "Invalid research area"
            }), 400

        # ----------------------------------------------------
        # NORMALIZE INPUT
        # ----------------------------------------------------

        honorific = honorific.strip()
        designation = designation.strip()
        photo_url = photo_url.strip()
        profile_url = profile_url.strip()

        allowed_honorifics = {
            "",
            "Dr.",
            "Prof.",
            "Mr.",
            "Mrs.",
            "Ms.",
            "Miss"
        }

        if honorific not in allowed_honorifics:
            return jsonify({
                "error": "Invalid title or honorific"
            }), 400

        if not designation:
            return jsonify({
                "error": "Designation is required"
            }), 400

        if len(designation) > 150:
            return jsonify({
                "error": "Designation is too long"
            }), 400

        if len(photo_url) > 2048 or len(profile_url) > 2048:
            return jsonify({
                "error": "A profile URL is too long"
            }), 400

        # ----------------------------------------------------
        # VALIDATE URLS
        # ----------------------------------------------------

        for url in [photo_url, profile_url]:

            if url and not re.match(
                r"^https?://",
                url,
                re.IGNORECASE
            ):
                return jsonify({
                    "error": "Profile URLs must begin with http:// or https://"
                }), 400

        # ----------------------------------------------------
        # NORMALIZE RESEARCH AREAS
        # ----------------------------------------------------

        cleaned_areas = []
        seen_areas = set()

        for area in research_areas:

            area = area.strip()

            if not area:
                continue

            if len(area) > 150:
                return jsonify({
                    "error": "A research area is too long"
                }), 400

            normalized = area.casefold()

            if normalized not in seen_areas:
                cleaned_areas.append(area)
                seen_areas.add(normalized)

        if len(cleaned_areas) > 30:
            return jsonify({
                "error": "You can add a maximum of 30 research areas"
            }), 400

        # ----------------------------------------------------
        # UPDATE EXISTING FACULTY PROFILE
        # ----------------------------------------------------

        with get_driver() as driver:

            with driver.session(database="neo4j") as db_session:

                def update_profile_transaction(tx):

                    # Verify the authenticated faculty account
                    # and update its existing Faculty node.

                    update_query = """
                    MATCH
                        (fa:FacultyAccount {email: $email})
                        -[:BELONGS_TO]->
                        (f:Faculty {faculty_id: $faculty_id})

                    SET
                        f.honorific = $honorific,
                        f.designation = $designation,
                        f.photo_url = $photo_url,
                        f.profile_url = $profile_url

                    WITH f

                    OPTIONAL MATCH
                        (f)-[old:HAS_RESEARCH_AREA]->(:ResearchArea)

                    DELETE old

                    RETURN f.faculty_id AS faculty_id
                    """

                    update_result = tx.run(
                        update_query,
                        email=email,
                        faculty_id=faculty_id,
                        honorific=honorific,
                        designation=designation,
                        photo_url=photo_url,
                        profile_url=profile_url
                    ).single()

                    if not update_result:
                        return False

                    # ------------------------------------------------
                    # RECREATE RESEARCH AREA RELATIONSHIPS
                    # ------------------------------------------------

                    for area in cleaned_areas:

                        # First check whether the ResearchArea
                        # node already exists.

                        find_area_query = """
                        MATCH (ra:ResearchArea)

                        WHERE
                            toLower(trim(
                                coalesce(ra.displayName, ra.name, '')
                            )) = toLower($area)

                        RETURN ra
                        LIMIT 1
                        """

                        existing_area = tx.run(
                            find_area_query,
                            area=area
                        ).single()

                        if existing_area:

                            # Reuse the existing ResearchArea node.

                            connect_query = """
                            MATCH
                                (f:Faculty {faculty_id: $faculty_id}),
                                (ra:ResearchArea)

                            WHERE
                                toLower(trim(
                                    coalesce(ra.displayName, ra.name, '')
                                )) = toLower($area)

                            MERGE (f)-[:HAS_RESEARCH_AREA]->(ra)

                            """

                            tx.run(
                                connect_query,
                                faculty_id=faculty_id,
                                area=area
                            ).consume()

                        else:

                            # Create a new ResearchArea node
                            # only when no matching node exists.

                            create_area_query = """
                            MATCH (f:Faculty {faculty_id: $faculty_id})

                            CREATE (ra:ResearchArea {
                                displayName: $area
                            })

                            CREATE (f)-[:HAS_RESEARCH_AREA]->(ra)

                            """

                            tx.run(
                                create_area_query,
                                faculty_id=faculty_id,
                                area=area
                            ).consume()

                    return True

                # Execute all profile and research-area changes
                # as one transaction.

                updated = db_session.execute_write(
                    update_profile_transaction
                )

                if not updated:
                    return jsonify({
                        "error": "Faculty profile not found or account is not linked correctly"
                    }), 404

        # ----------------------------------------------------
        # SUCCESS RESPONSE
        # ----------------------------------------------------

        return jsonify({
            "message": "Faculty profile updated successfully"
        }), 200

    except Exception:

        app.logger.exception("Faculty profile update failed")

        return jsonify({
            "error": "Unable to update faculty profile"
        }), 500

# FACULTY PHOTO
FACULTY_PHOTO_DIR = (
    Path(__file__).resolve().parent.parent
    / "data_processing"
    / "faculty"
    / "faculty_photos"
)

FACULTY_PHOTO_EXTENSIONS = [
    "jpg",
    "jpeg",
    "png",
    "webp"
]

@app.route("/faculty-photos/<faculty_id>", methods=["GET"])
def serve_faculty_photo(faculty_id):
    if not re.fullmatch(r"nm\d+", faculty_id):
        abort(404)

    for extension in FACULTY_PHOTO_EXTENSIONS:
        filename = f"{faculty_id}.{extension}"
        photo_path = FACULTY_PHOTO_DIR / filename

        if photo_path.is_file():
            return send_from_directory(FACULTY_PHOTO_DIR, filename)

    abort(404)

# ============================================================
# FACULTY LOGOUT
# ============================================================

@app.route("/faculty/logout", methods=["POST"])
def faculty_logout():

    try:

        if flask_session.get("user_role") != "faculty":

            return jsonify({
                "error": "No active faculty session"
            }), 401

        flask_session.clear()

        return jsonify({
            "message": "Faculty logout successful"
        }), 200

    except Exception:

        app.logger.exception("Faculty logout failed")

        return jsonify({
            "error": "Faculty logout failed"
        }), 500


# ============================================================
# LIKE / UNLIKE WORK
# ============================================================

@app.route(
    "/like-work",
    methods=["POST"]
)
def like_or_unlike_work():

    try:

        data = request.get_json() or {}

        email = data.get(
            "email"
        )

        work_id = (
            data.get("workId")
            or data.get("work_id")
            or data.get("id")
        )

        if not email or not work_id:

            return jsonify({
                "error":
                    "Missing email or workId"
            }), 400

        with get_driver() as driver:

            with driver.session() as session:

                check_query = """
                MATCH
                    (u:User {email: $email})
                    -[r:U_W_E {type:'LIKED'}]->
                    (w:Work {id: $work_id})

                RETURN
                    count(r) AS rel_count
                """

                result = session.run(
                    check_query,
                    email=email,
                    work_id=work_id
                ).single()

                rel_exists = (
                    result["rel_count"] > 0
                )

                if rel_exists:

                    query = """
                    MATCH
                        (u:User {email: $email})
                        -[r:U_W_E {type:'LIKED'}]->
                        (w:Work {id: $work_id})

                    DELETE r

                    SET
                        w.likes =
                            CASE
                                WHEN coalesce(
                                    w.likes,
                                    0
                                ) > 0
                                THEN w.likes - 1
                                ELSE 0
                            END

                    RETURN
                        w.id AS work_id,
                        w.likes AS likes
                    """

                    action = "unliked"

                else:

                    query = """
                    MATCH
                        (u:User {email: $email})

                    MATCH
                        (w:Work {id: $work_id})

                    MERGE
                        (u)-[:U_W_E {
                            type:'LIKED'
                        }]->(w)

                    SET
                        w.likes =
                            coalesce(
                                w.likes,
                                0
                            ) + 1

                    RETURN
                        w.id AS work_id,
                        w.likes AS likes
                    """

                    action = "liked"

                result = session.run(
                    query,
                    email=email,
                    work_id=work_id
                ).single()

                if result is None:

                    return jsonify({
                        "error":
                            "Research paper not found",

                        "work_id":
                            work_id
                    }), 404

        get_cached_recommendations.cache_clear()

        return jsonify({
            "action":
                action,

            "work_id":
                result["work_id"],

            "likes":
                result["likes"]
        }), 200

    except Exception as e:

        print(
            "Like/unlike error:",
            e
        )

        return jsonify({
            "error":
                "Failed to like/unlike work",

            "details":
                str(e)
        }), 500


# ============================================================
# SIMILAR USER WORKS
# ============================================================

@app.route(
    "/similar-user-works",
    methods=["POST"]
)
def get_similar_user_works():

    try:

        data = request.get_json() or {}

        email = data.get(
            "email"
        )

        if not email:

            return jsonify({
                "error":
                    "Missing user email"
            }), 400

        query = """
        MATCH
            (u1:User {email: $email})

        MATCH
            (u2:User)

        WHERE
            u1 <> u2
            AND u2.interests IS NOT NULL
            AND u1.interests IS NOT NULL

        WITH
            u1,
            u2,

            [
                interest IN u1.interests

                WHERE any(
                    otherInterest IN u2.interests

                    WHERE
                        toLower(
                            trim(interest)
                        )
                        =
                        toLower(
                            trim(otherInterest)
                        )
                )
            ] AS sharedInterestList

        WITH
            u1,
            u2,
            sharedInterestList,
            size(
                sharedInterestList
            ) AS shared_interests

        WHERE
            shared_interests > 0

        ORDER BY
            shared_interests DESC

        LIMIT 5

        MATCH
            (u2)
            -[:U_W_E {type:'LIKED'}]->
            (w:Work)

        WHERE NOT (
            (u1)
            -[:U_W_E {type:'LIKED'}]->
            (w)
        )

        RETURN DISTINCT
            w.id AS id,

            w.displayName AS title,

            w.abstract AS summary,

            'https://openalex.org/works/'
                + w.id AS url,

            [
                (w)<-[:W_A_E]-(a:Author)
                |
                {
                    name:
                        coalesce(
                            a.name,
                            a.displayName
                        ),
                    id:
                        a.id
                }
            ] AS authors,

            coalesce(
                w.likes,
                0
            ) AS likes,

            shared_interests AS score

        ORDER BY
            score DESC,
            likes DESC

        LIMIT 20
        """

        with get_driver() as driver:

            with driver.session() as session:

                results = session.run(
                    query,
                    email=email
                )

                works = [
                    record.data()
                    for record in results
                ]

        return jsonify({
            "recommendations":
                works
        }), 200

    except Exception as e:

        print(
            "Similar-user recommendation error:",
            e
        )

        return jsonify({
            "error": (
                "Failed to generate "
                "similar-user recommendations"
            ),

            "details":
                str(e)
        }), 500



# ============================================================
# STUDENT LOGIN
# ============================================================

@app.route(
    "/login",
    methods=["POST"]
)
def login():

    try:

        data = request.get_json() or {}

        email = data.get("email")
        password = data.get("password")

        # ----------------------------------------------------
        # VALIDATION
        # ----------------------------------------------------

        if not email or not password:

            return jsonify({
                "error": "Missing email or password"
            }), 400

        if not isinstance(email, str) or not isinstance(password, str):

            return jsonify({
                "error": "Invalid email or password"
            }), 400

        cleaned_email = email.strip().lower()

        if not cleaned_email:

            return jsonify({
                "error": "Missing email or password"
            }), 400

        # ----------------------------------------------------
        # FIND STUDENT ACCOUNT
        # ----------------------------------------------------

        with get_driver() as driver:

            with driver.session(database="neo4j") as session:

                query = """
                MATCH (u:User {email: $email})

                RETURN
                    u.password_hash AS password_hash,
                    coalesce(u.role, 'student') AS role
                """

                result = session.run(
                    query,
                    email=cleaned_email
                ).single()

                if not result:

                    return jsonify({
                        "error": "Invalid email or password"
                    }), 401

                password_hash = result["password_hash"]
                account_role = result["role"]

                # ------------------------------------------------
                # ROLE VALIDATION
                # ------------------------------------------------

                if account_role != "student":

                    return jsonify({
                        "error": "Please use the appropriate login for your account."
                    }), 403

                # ------------------------------------------------
                # PASSWORD VERIFICATION
                # ------------------------------------------------

                if not password_hash or not bcrypt.check_password_hash(
                    password_hash,
                    password
                ):

                    return jsonify({
                        "error": "Invalid email or password"
                    }), 401

        # ----------------------------------------------------
        # CREATE STUDENT SESSION
        # ----------------------------------------------------

        flask_session.clear()

        flask_session["user_email"] = cleaned_email
        flask_session["user_role"] = "student"

        flask_session.permanent = True

        # ----------------------------------------------------
        # SUCCESS RESPONSE
        # ----------------------------------------------------

        return jsonify({
            "message": "Login successful",
            "email": cleaned_email,
            "role": "student"
        }), 200

    except Exception:

        app.logger.exception("Student login route failed")

        return jsonify({
            "error": "Login failed"
        }), 500




# LOGOUT ROUTE


@app.route("/logout", methods=["POST"])
def logout():
    flask_session.clear()

    return jsonify({
        "message": "Logged out successfully"
    }), 200


# SESSION CHECK ROUTE


@app.route("/session", methods=["GET"])
def check_session():
    email = flask_session.get("user_email")

    if not email:
        return jsonify({
            "authenticated": False
        }), 401

    return jsonify({
        "authenticated": True,
        "email": email
    }), 200


# ============================================================
# CREATE RESEARCH GROUP
#
# POST /group/create
#
# The logged-in account is already represented by:
#
# (:User {email: owner_email})
#
# This endpoint:
#
# 1. Verifies that the owner exists.
# 2. Creates a ResearchGroup node.
# 3. Connects the User to the ResearchGroup using OWNS_GROUP.
# 4. Creates one GroupMemberProfile node for every
#    additional group member.
# 5. Connects each member using HAS_MEMBER.
# 6. Stores interests, goals, skills and publications.
# 7. Creates separate GroupInterest, GroupGoal and
#    GroupSkill nodes for graph-based representation.
#
# Maximum additional members = 3.
# ============================================================

@app.route(
    "/group/create",
    methods=["POST"]
)
def create_research_group():

    try:

        data = request.get_json() or {}

        # ====================================================
        # OWNER
        # ====================================================

        owner_email = str(
            data.get(
                "owner_email",
                ""
            )
        ).strip().lower()

        if not owner_email:

            return jsonify({
                "error":
                    "Owner email is required."
            }), 400

        # ====================================================
        # MEMBERS
        # ====================================================

        members = data.get(
            "members",
            []
        )

        if not isinstance(
            members,
            list
        ):

            return jsonify({
                "error":
                    "Members must be provided as a list."
            }), 400

        # ----------------------------------------------------
        # A GROUP MUST HAVE AT LEAST ONE ADDITIONAL MEMBER
        # ----------------------------------------------------

        if len(members) < 1:

            return jsonify({
                "error":
                    "Please add at least one group member."
            }), 400

        # ----------------------------------------------------
        # MAXIMUM 3 ADDITIONAL MEMBERS
        # ----------------------------------------------------

        if len(members) > 3:

            return jsonify({
                "error":
                    "A maximum of 3 additional group members is allowed."
            }), 400

        # ====================================================
        # CLEAN MEMBER DATA
        # ====================================================

        cleaned_members = []

        for index, member in enumerate(
            members,
            start=1
        ):

            if not isinstance(
                member,
                dict
            ):

                return jsonify({
                    "error":
                        f"Member {index} is invalid."
                }), 400

            name = str(
                member.get(
                    "name",
                    ""
                )
            ).strip()

            email = str(
                member.get(
                    "email",
                    ""
                )
            ).strip().lower()

            interests = member.get(
                "interests",
                []
            )

            goals = member.get(
                "goals",
                []
            )

            skills = member.get(
                "skills",
                []
            )

            publications = str(
                member.get(
                    "publications",
                    ""
                )
            ).strip()

            # ------------------------------------------------
            # REQUIRED FIELDS
            # ------------------------------------------------

            if not name:

                return jsonify({
                    "error":
                        f"Member {index}: name is required."
                }), 400

            if not email:

                return jsonify({
                    "error":
                        f"Member {index}: email is required."
                }), 400

            # ------------------------------------------------
            # BASIC EMAIL VALIDATION
            # ------------------------------------------------

            if not re.match(
                r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
                email
            ):

                return jsonify({
                    "error":
                        f"Member {index}: invalid email address."
                }), 400

            # ------------------------------------------------
            # LIST VALIDATION
            # ------------------------------------------------

            if not isinstance(
                interests,
                list
            ):

                interests = []

            if not isinstance(
                goals,
                list
            ):

                goals = []

            if not isinstance(
                skills,
                list
            ):

                skills = []

            # ------------------------------------------------
            # CLEAN LIST VALUES
            # ------------------------------------------------

            def clean_list(values):

                cleaned = []

                for value in values:

                    if not isinstance(
                        value,
                        str
                    ):
                        continue

                    value = value.strip()

                    if not value:
                        continue

                    already_exists = any(
                        existing.lower() == value.lower()
                        for existing in cleaned
                    )

                    if not already_exists:

                        cleaned.append(
                            value
                        )

                return cleaned

            interests = clean_list(
                interests
            )

            goals = clean_list(
                goals
            )

            skills = clean_list(
                skills
            )

            # ------------------------------------------------
            # REQUIRED PROFILE INFORMATION
            # ------------------------------------------------

            if not interests:

                return jsonify({
                    "error":
                        f"Member {index}: at least one interest is required."
                }), 400

            if not goals:

                return jsonify({
                    "error":
                        f"Member {index}: at least one goal is required."
                }), 400

            if not skills:

                return jsonify({
                    "error":
                        f"Member {index}: at least one skill is required."
                }), 400

            cleaned_members.append({
                "name":
                    name,

                "email":
                    email,

                "interests":
                    interests,

                "goals":
                    goals,

                "skills":
                    skills,

                "publications":
                    publications
            })

        # ====================================================
        # PREVENT OWNER FROM BEING ADDED AS MEMBER
        # ====================================================

        for member in cleaned_members:

            if member["email"] == owner_email:

                return jsonify({
                    "error":
                        "The group owner is already part of the group and cannot be added again."
                }), 400

        # ====================================================
        # GENERATE UNIQUE GROUP ID
        # ====================================================

        group_id = str(
            uuid.uuid4()
        )

        # ====================================================
        # CREATE GROUP IN NEO4J
        # ====================================================

        with get_driver() as driver:

            with driver.session(
                database="neo4j"
            ) as session:

                # ------------------------------------------------
                # VERIFY OWNER
                # ------------------------------------------------

                owner_result = session.run(
                    """
                    MATCH (u:User {email: $owner_email})

                    RETURN
                        u.email AS email
                    """,
                    owner_email=owner_email
                ).single()

                if owner_result is None:

                    return jsonify({
                        "error":
                            "The logged-in owner account was not found in Neo4j."
                    }), 404

                # ------------------------------------------------
                # CREATE RESEARCH GROUP
                # ------------------------------------------------

                session.run(
                    """
                    MATCH (u:User {email: $owner_email})

                    CREATE (g:ResearchGroup {
                        group_id: $group_id,
                        created_at: datetime(),
                        member_count: $member_count,
                        additional_member_count: $additional_member_count
                    })

                    CREATE (u)-[:OWNS_GROUP]->(g)
                    """,
                    owner_email=owner_email,
                    group_id=group_id,
                    member_count=len(cleaned_members) + 1,
                    additional_member_count=len(
                        cleaned_members
                    )
                )

                # =================================================
                # CREATE EACH MEMBER
                # =================================================

                for member in cleaned_members:

                    member_id = str(
                        uuid.uuid4()
                    )

                    # ------------------------------------------------
                    # CREATE MEMBER PROFILE
                    # ------------------------------------------------

                    session.run(
                        """
                        MATCH
                            (g:ResearchGroup {
                                group_id: $group_id
                            })

                        CREATE (m:GroupMemberProfile {
                            member_id: $member_id,

                            name: $name,

                            email: $email,

                            interests: $interests,

                            goals: $goals,

                            skills: $skills,

                            publications: $publications,

                            created_at: datetime()
                        })

                        CREATE
                            (g)-[:HAS_MEMBER]->(m)
                        """,
                        group_id=group_id,
                        member_id=member_id,
                        name=member["name"],
                        email=member["email"],
                        interests=member["interests"],
                        goals=member["goals"],
                        skills=member["skills"],
                        publications=member["publications"]
                    )

                    # ------------------------------------------------
                    # CREATE INTEREST NODES
                    # ------------------------------------------------

                    for interest in member["interests"]:

                        session.run(
                            """
                            MATCH
                                (m:GroupMemberProfile {
                                    member_id: $member_id
                                })

                            MERGE
                                (i:GroupInterest {
                                    name: $interest_key
                                })

                            SET
                                i.displayName = $interest

                            MERGE
                                (m)-[:HAS_INTEREST]->(i)
                            """,
                            member_id=member_id,
                            interest=interest,
                            interest_key=interest.lower().strip()
                        )

                    # ------------------------------------------------
                    # CREATE GOAL NODES
                    # ------------------------------------------------

                    for goal in member["goals"]:

                        session.run(
                            """
                            MATCH
                                (m:GroupMemberProfile {
                                    member_id: $member_id
                                })

                            MERGE
                                (g:GroupGoal {
                                    name: $goal_key
                                })

                            SET
                                g.displayName = $goal

                            MERGE
                                (m)-[:HAS_GOAL]->(g)
                            """,
                            member_id=member_id,
                            goal=goal,
                            goal_key=goal.lower().strip()
                        )

                    # ------------------------------------------------
                    # CREATE SKILL NODES
                    # ------------------------------------------------

                    for skill in member["skills"]:

                        session.run(
                            """
                            MATCH
                                (m:GroupMemberProfile {
                                    member_id: $member_id
                                })

                            MERGE
                                (s:GroupSkill {
                                    name: $skill_key
                                })

                            SET
                                s.displayName = $skill

                            MERGE
                                (m)-[:HAS_SKILL]->(s)
                            """,
                            member_id=member_id,
                            skill=skill,
                            skill_key=skill.lower().strip()
                        )

        # ====================================================
        # SUCCESS
        # ====================================================

        return jsonify({

            "status":
                "success",

            "message":
                "Research group created successfully.",

            "group_id":
                group_id,

            "owner_email":
                owner_email,

            "member_count":
                len(cleaned_members) + 1,

            "additional_member_count":
                len(cleaned_members),

            "members":
                cleaned_members

        }), 201

    except Exception as e:

        print()
        print("=" * 60)
        print("RESEARCH GROUP CREATION ERROR")
        print("=" * 60)

        print(
            repr(e)
        )

        print("=" * 60)

        return jsonify({

            "error":
                "Failed to create research group.",

            "details":
                str(e)

        }), 500

# ============================================================
# GET PROFILE
# ============================================================

@app.route(
    "/get-profile",
    methods=["POST"]
)
def get_profile():

    try:

        data = request.get_json() or {}

        email = data.get(
            "email"
        )

        if not email:

            return jsonify({
                "error":
                    "Missing email"
            }), 400

        with get_driver() as driver:

            with driver.session() as session:

                query = """
                MATCH
                    (u:User {email: $email})

                OPTIONAL MATCH
                    (u)-[:U_W_E {
                        type:'LIKED'
                    }]->(w:Work)

                WITH
                    u,
                    collect(
                        DISTINCT w
                    ) AS works

                RETURN
                    u.email AS email,

                    toString(
                        u.created_at
                    ) AS created_at,

                    u.interests AS interests,

                    u.research_goal AS research_goal,

                    u.experience_level AS experience_level,

                    u.skills AS skills,

                    [
                        x IN works

                        WHERE
                            x IS NOT NULL

                        |
                        {
                            id:
                                x.id,

                            title:
                                x.displayName,

                            summary:
                                x.abstract
                        }
                    ] AS liked_works
                """

                result = session.run(
                    query,
                    email=email
                ).single()

                if not result:

                    return jsonify({
                        "error":
                            "User not found"
                    }), 404

                return jsonify({
                    "name":
                        result["email"].split("@")[0],

                    "email":
                        result["email"],

                    "member_since":
                        result["created_at"]
                        or "Unknown",

                    "account_type":
                        "Standard",

                    "interests":
                        result["interests"]
                        or [],

                    "research_goal":
                        result["research_goal"]
                        or "",

                    "experience_level":
                        result["experience_level"]
                        or "",

                    "skills":
                        result["skills"]
                        or [],

                    "liked_works":
                        result["liked_works"]
                        or []
                }), 200

    except Exception as e:

        return jsonify({
            "error":
                "Failed to get profile",

            "details":
                str(e)
        }), 500


# ============================================================
# DELETE ACCOUNT
# ============================================================

@app.route(
    "/delete-account",
    methods=["DELETE"]
)
def delete_account():

    try:

        data = request.get_json() or {}

        email = data.get(
            "email"
        )

        if not email:

            return jsonify({
                "error":
                    "Missing email"
            }), 400

        with get_driver() as driver:

            with driver.session() as session:

                query = """
                MATCH
                    (u:User {email: $email})

                DETACH DELETE u
                """

                session.run(
                    query,
                    email=email
                )

        get_cached_recommendations.cache_clear()

        return jsonify({
            "message":
                "Account deleted successfully"
        }), 200

    except Exception as e:

        return jsonify({
            "error":
                "Failed to delete account",

            "details":
                str(e)
        }), 500


# ============================================================
# REPAIR EXISTING USERS
# ============================================================

def repair_existing_users():

    try:

        print()
        print("=" * 60)
        print("CHECKING EXISTING USER PROFILES")
        print("=" * 60)

        migration_query = """
        MATCH (u:User)

        SET
            u.interests =
                coalesce(
                    u.interests,
                    []
                ),

            u.research_goal =
                coalesce(
                    u.research_goal,
                    ""
                ),

            u.experience_level =
                coalesce(
                    u.experience_level,
                    ""
                ),

            u.skills =
                coalesce(
                    u.skills,
                    []
                )

        RETURN
            count(u) AS usersUpdated
        """

        with get_driver() as driver:

            result = driver.execute_query(
                migration_query,
                database_="neo4j"
            )

        if result[0]:

            count = result[0][0][
                "usersUpdated"
            ]

            print(
                "Users migrated:",
                count
            )

    except Exception as e:

        print(
            "Existing-user repair failed:",
            e
        )



# ============================================================
# RESEARCHPILOT FACULTY RECOMMENDATIONS
#
# POST /faculty-recommendations
#
# Dedicated PES faculty graph:
#   (:Faculty)-[:HAS_RESEARCH_AREA]-(:ResearchArea)
#   (:Faculty)-[:HAS_PUBLICATION]-(:FacultyPublication)
#
# Matching signals:
#   1. Project title and description
#   2. Problem statement and research gaps
#   3. Proposed approach and technologies
#   4. Student interests, goals and skills
#   5. Faculty research areas
#   6. Faculty publication titles and source text
#
# No LLM is used for faculty retrieval, scoring or ranking.
# The OpenAlex Author/Work graph is not used here.
# ============================================================

import math
import re


# ------------------------------------------------------------
# TEXT PROCESSING
# ------------------------------------------------------------

FACULTY_STOPWORDS = {
    "the", "and", "for", "with", "from", "that", "this",
    "these", "those", "into", "using", "use", "used",
    "based", "approach", "system", "systems", "study",
    "research", "project", "work", "paper", "papers",
    "method", "methods", "model", "models", "new",
    "novel", "can", "could", "would", "should", "will",
    "are", "was", "were", "been", "being", "have", "has",
    "had", "its", "their", "them", "they", "our", "your",
    "you", "who", "what", "when", "where", "how", "why",
    "not", "but", "also", "than", "then", "such", "more",
    "most", "some", "many", "much", "each", "other",
    "through", "within", "between", "across", "about",
    "over", "under", "toward", "towards",
    "provide", "provides", "provided", "improve",
    "improved", "improving", "identify", "identifying",
    "development", "develop", "developing",
    "implementation", "proposed", "effective",
    "efficient", "various", "different", "existing",
    "potential", "results", "result", "analysis",
    "information", "data", "application", "applications"
}


def faculty_clean_string(value):
    """Return a stripped string for scalar string values."""
    if value is None:
        return ""

    if isinstance(value, str):
        return value.strip()

    if isinstance(value, (int, float)):
        return str(value)

    return ""


def faculty_get_tokens(text):
    """
    Extract normalized lexical tokens.

    This is keyword matching, not semantic similarity.
    """
    if not text:
        return set()

    words = re.findall(
        r"[a-zA-Z0-9+#.]+",
        str(text).lower()
    )

    tokens = set()

    for word in words:
        word = word.strip(".")

        if len(word) < 3:
            continue

        if word in FACULTY_STOPWORDS:
            continue

        tokens.add(word)

    return tokens


def faculty_normalize_list(value):
    """Normalize a list of strings and remove duplicates."""
    if not isinstance(value, list):
        return []

    result = []
    seen = set()

    for item in value:
        if not isinstance(item, str):
            continue

        item = item.strip()
        key = item.lower()

        if item and key not in seen:
            result.append(item)
            seen.add(key)

    return result


def faculty_collect_text(value, depth=0):
    """Extract text from supported nested dictionaries and lists."""
    if depth > 5 or value is None:
        return []

    if isinstance(value, str):
        value = value.strip()
        return [value] if value else []

    if isinstance(value, (int, float)):
        return []

    if isinstance(value, list):
        result = []

        for item in value:
            result.extend(
                faculty_collect_text(item, depth + 1)
            )

        return result

    if isinstance(value, dict):
        result = []

        preferred_fields = [
            "title",
            "name",
            "description",
            "summary",
            "abstract",
            "source_text",
            "problem_statement",
            "problemStatement",
            "research_gap",
            "research_gaps",
            "gap",
            "gap_description",
            "proposed_approach",
            "approach",
            "methodology",
            "technologies",
            "recommended_technologies",
            "expected_outcome",
            "evaluation",
            "goals",
            "skills",
            "interests",
            "research_areas",
            "expertise",
            "concepts",
            "keywords"
        ]

        for key in preferred_fields:
            if key in value:
                result.extend(
                    faculty_collect_text(
                        value[key],
                        depth + 1
                    )
                )

        return result

    return []


def faculty_unique_text(values, maximum=60):
    """Deduplicate strings while preserving their order."""
    result = []
    seen = set()

    for value in values:
        if not isinstance(value, str):
            continue

        value = value.strip()
        key = value.lower()

        if not value or key in seen:
            continue

        result.append(value)
        seen.add(key)

        if len(result) >= maximum:
            break

    return result


# ------------------------------------------------------------
# PROJECT CONTEXT EXTRACTION
# ------------------------------------------------------------

def build_faculty_matching_context(data):
    """
    Build a consistent context from the frontend payload.

    Supports top-level fields and nested project_context
    and project_idea dictionaries.
    """
    project_context = data.get("project_context")

    if not isinstance(project_context, dict):
        project_context = {}

    project_idea = data.get("project_idea")

    if not isinstance(project_idea, dict):
        project_idea = {}

    def first_text(*values):
        for value in values:
            if isinstance(value, str) and value.strip():
                return value.strip()

        return ""

    project_title = first_text(
        data.get("project_title"),
        data.get("title"),
        project_idea.get("title"),
        project_context.get("project_title"),
        project_context.get("title")
    )

    project_description = first_text(
        data.get("description"),
        data.get("project_description"),
        project_idea.get("description"),
        project_context.get("description")
    )

    problem_statement = first_text(
        data.get("problem_statement"),
        data.get("problemStatement"),
        project_idea.get("problem_statement"),
        project_context.get("problem_statement")
    )

    research_gap = first_text(
        data.get("research_gap"),
        project_idea.get("research_gap"),
        project_context.get("research_gap")
    )

    proposed_approach = first_text(
        data.get("proposed_approach"),
        project_idea.get("proposed_approach"),
        project_context.get("proposed_approach")
    )

    technologies = faculty_unique_text(
        faculty_collect_text(
            data.get("recommended_technologies")
        )
        + faculty_collect_text(
            data.get("technologies")
        )
        + faculty_collect_text(
            project_idea.get("recommended_technologies")
        )
        + faculty_collect_text(
            project_context.get("recommended_technologies")
        )
    )

    goals = faculty_unique_text(
        faculty_collect_text(data.get("goals"))
        + faculty_collect_text(
            project_context.get("goals")
        )
    )

    skills = faculty_unique_text(
        faculty_collect_text(data.get("skills"))
        + faculty_collect_text(
            project_context.get("skills")
        )
    )

    interests = faculty_unique_text(
        faculty_collect_text(data.get("interests"))
        + faculty_collect_text(
            project_context.get("interests")
        )
    )

    research_gaps = (
        data.get("research_gaps")
        or data.get("researchGaps")
        or project_context.get("research_gaps")
        or project_context.get("researchGaps")
        or data.get("researchGapData")
        or project_context.get("researchGapData")
        or []
    )

    if isinstance(research_gaps, str):
        research_gaps = [research_gaps]

    papers = (
        data.get("papers")
        or project_context.get("papers")
        or []
    )

    if not isinstance(papers, list):
        papers = []

    paper_texts = []

    for paper in papers:
        if isinstance(paper, dict):
            title = faculty_clean_string(
                paper.get("title")
            )

            abstract = faculty_clean_string(
                paper.get("abstract")
                or paper.get("summary")
                or paper.get("description")
            )

            combined = " ".join(
                part for part in [title, abstract]
                if part
            )

            if combined:
                paper_texts.append(combined)

        elif isinstance(paper, str) and paper.strip():
            paper_texts.append(paper.strip())

    gap_texts = faculty_collect_text(research_gaps)

    core_text = " ".join([
        project_title,
        project_description,
        problem_statement,
        research_gap,
        " ".join(gap_texts),
        proposed_approach
    ])

    supporting_text = " ".join([
        " ".join(technologies),
        " ".join(goals),
        " ".join(skills),
        " ".join(interests),
        " ".join(paper_texts)
    ])

    return {
        "project_title": project_title,
        "project_description": project_description,
        "problem_statement": problem_statement,
        "research_gap": research_gap,
        "proposed_approach": proposed_approach,
        "technologies": technologies,
        "goals": goals,
        "skills": skills,
        "interests": interests,
        "research_gaps": research_gaps,
        "papers": papers,
        "core_text": core_text,
        "supporting_text": supporting_text,
        "all_text": core_text + " " + supporting_text
    }


# ------------------------------------------------------------
# PES FACULTY GRAPH RETRIEVAL
# ------------------------------------------------------------

def retrieve_pes_faculty_candidates(driver):
    """
    Retrieve faculty from the dedicated PES faculty graph.

    Expected relationships, verified against the current graph:

        (f:Faculty)-[:HAS_RESEARCH_AREA]-(ra:ResearchArea)
        (f:Faculty)-[:HAS_PUBLICATION]-(p:FacultyPublication)

    This function deliberately does not query the OpenAlex
    Author/Work graph or papers_search_english index.
    """

    cypher_query = """
    MATCH (f:Faculty)

    CALL {
        WITH f

        OPTIONAL MATCH
            (f)-[:HAS_RESEARCH_AREA]-(ra:ResearchArea)

        RETURN
            collect(DISTINCT properties(ra))
            AS research_area_records
    }

    CALL {
        WITH f

        OPTIONAL MATCH
            (f)-[:HAS_PUBLICATION]-(p:FacultyPublication)

        RETURN
            collect(DISTINCT properties(p))
            AS publication_records
    }

    RETURN
        properties(f) AS faculty,
        research_area_records,
        publication_records

    ORDER BY coalesce(f.name, '')
    """

    records, _, _ = driver.execute_query(
        cypher_query,
        database_="neo4j"
    )

    candidates = []

    for record in records:
        faculty = record.get("faculty") or {}

        if not isinstance(faculty, dict):
            continue

        name = faculty_clean_string(
            faculty.get("name")
        )

        if not name:
            continue

        faculty_id = faculty_clean_string(
            faculty.get("faculty_id")
        )

        profile_url = faculty_clean_string(
            faculty.get("profile_url")
        )

        department = faculty_clean_string(
            faculty.get("department")
        )

        campus = faculty_clean_string(
            faculty.get("campus")
        )

        research_area_records = (
            record.get("research_area_records") or []
        )

        publication_records = (
            record.get("publication_records") or []
        )

        # Collect connected ResearchArea names.
        research_areas = []

        for area in research_area_records:
            if not isinstance(area, dict):
                continue

            area_name = faculty_clean_string(
                area.get("name")
                or area.get("normalized_name")
            )

            if area_name:
                research_areas.append(area_name)

        # Include the faculty node's stored area fields too.
        # These provide a fallback if some relationships are
        # missing from the imported graph.
        research_areas.extend(
            faculty_collect_text(
                faculty.get("research_areas")
            )
        )

        research_areas.extend(
            faculty_collect_text(
                faculty.get("research_areas_raw")
            )
        )

        research_areas = faculty_unique_text(
            research_areas,
            maximum=100
        )

        # Convert FacultyPublication properties into the
        # common publication shape used by the scoring code.
        papers = []
        seen_publications = set()

        for publication in publication_records:
            if not isinstance(publication, dict):
                continue

            title = faculty_clean_string(
                publication.get("title")
            )

            source_text = faculty_clean_string(
                publication.get("source_text")
            )

            # Some records may have source_text but no title.
            display_title = title or source_text

            if not display_title:
                continue

            publication_id = faculty_clean_string(
                publication.get("publication_id")
            )

            if not publication_id:
                publication_id = (
                    faculty_clean_string(
                        publication.get("profile_url")
                    )
                    + "|"
                    + display_title.lower()
                )

            if publication_id in seen_publications:
                continue

            seen_publications.add(publication_id)

            papers.append({
                "id": publication_id,
                "title": display_title,
                "abstract": source_text,
                "source_text": source_text,
                "profile_url": faculty_clean_string(
                    publication.get("profile_url")
                ),
                "verification_status": faculty_clean_string(
                    publication.get("verification_status")
                ),
                "data_source": faculty_clean_string(
                    publication.get("data_source")
                )
            })

        # Keep the faculty's original verification status.
        faculty_verification = faculty_clean_string(
            faculty.get("source_verification_status")
            or faculty.get("verification_status")
        )

        candidates.append({
            "name": name,
            "id": faculty_id,
            "faculty_id": faculty_id,
            "profile_url": profile_url,
            "department": department,
            "campus": campus,
            "research_areas": research_areas,
            "papers": papers,
            "publication_count": len(papers),
            "verification_status": faculty_verification,
            "data_source": faculty_clean_string(
                faculty.get("data_source")
            ),

            # The PES graph shown so far does not establish
            # OpenAlex citation metrics for these Faculty nodes.
            # Do not borrow metrics from unrelated Author nodes.
            "h_index": 0,
            "i10_index": 0,
            "cited_by_count": 0
        })

    return candidates


# ------------------------------------------------------------
# ALGORITHMIC MATCH SCORING
# ------------------------------------------------------------

def calculate_faculty_match(candidate, context):
    """
    Score a PES faculty member using lexical evidence.

    Weights:
        50% project/core-context token coverage
        20% supporting-context token coverage
        20% research-area token coverage
        10% relevant-publication evidence

    These are initial engineering weights, not empirically
    validated weights. They can be tuned using evaluation data.

    Citation metrics are not used because they are not currently
    established for the dedicated PES Faculty records.
    """

    papers = candidate.get("papers") or []

    research_areas = candidate.get("research_areas") or []

    # Build the evidence text from faculty expertise and
    # publication titles/source text.
    publication_texts = []

    for paper in papers:
        if not isinstance(paper, dict):
            continue

        title = faculty_clean_string(
            paper.get("title")
        )

        source_text = faculty_clean_string(
            paper.get("source_text")
            or paper.get("abstract")
        )

        text = " ".join(
            part for part in [title, source_text]
            if part
        )

        if text:
            publication_texts.append(text)

    research_area_text = " ".join(research_areas)
    publication_text = " ".join(publication_texts)

    faculty_evidence_text = " ".join([
        candidate.get("name") or "",
        candidate.get("department") or "",
        research_area_text,
        publication_text
    ])

    faculty_tokens = faculty_get_tokens(
        faculty_evidence_text
    )

    research_area_tokens = faculty_get_tokens(
        research_area_text
    )

    core_tokens = faculty_get_tokens(
        context.get("core_text", "")
    )

    supporting_tokens = faculty_get_tokens(
        context.get("supporting_text", "")
    )

    core_matches = core_tokens & faculty_tokens
    supporting_matches = supporting_tokens & faculty_tokens
    area_matches = core_tokens & research_area_tokens

    core_coverage = (
        len(core_matches) / len(core_tokens)
        if core_tokens else 0.0
    )

    supporting_coverage = (
        len(supporting_matches) / len(supporting_tokens)
        if supporting_tokens else 0.0
    )

    area_coverage = (
        len(area_matches) / len(core_tokens)
        if core_tokens else 0.0
    )

    # Identify individual publications that overlap with
    # the project's core research context.
    relevant_publications = []

    for paper in papers:
        if not isinstance(paper, dict):
            continue

        title = faculty_clean_string(
            paper.get("title")
        )

        source_text = faculty_clean_string(
            paper.get("source_text")
            or paper.get("abstract")
        )

        paper_tokens = faculty_get_tokens(
            title + " " + source_text
        )

        overlap = paper_tokens & core_tokens

        if overlap:
            relevant_publications.append({
                "id": paper.get("id"),
                "title": title or "Untitled publication",
                "profile_url": paper.get("profile_url"),
                "verification_status": (
                    paper.get("verification_status")
                ),
                "data_source": paper.get("data_source"),
                "matched_terms": sorted(overlap)[:8],
                "overlap_count": len(overlap)
            })

    relevant_publications.sort(
        key=lambda item: (
            item["overlap_count"],
            item["title"].lower()
        ),
        reverse=True
    )

    # Saturating evidence score: several relevant publications
    # help, but publication volume cannot dominate the ranking.
    publication_evidence = min(
        len(relevant_publications) / 5.0,
        1.0
    )

    raw_score = (
        0.50 * core_coverage
        + 0.20 * supporting_coverage
        + 0.20 * area_coverage
        + 0.10 * publication_evidence
    )

    score = round(
        max(0.0, min(raw_score, 1.0)) * 100,
        2
    )

    title_tokens = faculty_get_tokens(
        context.get("project_title", "")
    )

    matched_terms = sorted(
        core_matches,
        key=lambda token: (
            token not in title_tokens,
            token
        )
    )

    reasons = []

    if area_matches:
        reasons.append(
            "Research-area overlap: "
            + ", ".join(sorted(area_matches)[:8])
        )

    if relevant_publications:
        reasons.append(
            f"{len(relevant_publications)} faculty publication(s) "
            "contain keywords matching the project's core context"
        )

    if matched_terms:
        reasons.append(
            "Matched project terms: "
            + ", ".join(matched_terms[:8])
        )

    if supporting_matches:
        reasons.append(
            "Supporting overlap with interests, skills, goals "
            "or technologies: "
            + ", ".join(sorted(supporting_matches)[:6])
        )

    if not reasons:
        reasons.append(
            "Limited direct keyword overlap was found in the "
            "available faculty research areas and publication records."
        )

    return {
        "score": score,
        "core_coverage": round(core_coverage * 100, 2),
        "supporting_coverage": round(
            supporting_coverage * 100,
            2
        ),
        "research_area_coverage": round(
            area_coverage * 100,
            2
        ),
        "matched_terms": matched_terms[:12],
        "relevant_publications": relevant_publications[:5],
        "relevant_publication_count": len(
            relevant_publications
        ),
        "match_reason": ". ".join(reasons) + "."
    }


# ------------------------------------------------------------
# FACULTY RECOMMENDATIONS ENDPOINT
# ------------------------------------------------------------


@app.route(
    "/faculty-recommendations",
    methods=["POST"]
)
def faculty_recommendations():

    try:
        data = request.get_json(silent=True) or {}

        if not isinstance(data, dict):
            return jsonify({
                "error": "A JSON object is required.",
                "faculty_recommendations": [],
                "recommendations": [],
                "faculty": []
            }), 400

        context = build_faculty_matching_context(data)

        if not context["all_text"].strip():
            return jsonify({
                "error": (
                    "Insufficient project context. Provide a "
                    "project title, problem statement, research "
                    "gap, approach or related research papers."
                ),
                "faculty_recommendations": [],
                "recommendations": [],
                "faculty": []
            }), 400

        # Retrieve from the dedicated PES faculty dataset.
        with get_driver() as driver:
            candidates = retrieve_pes_faculty_candidates(
                driver
            )

        ranked = []

        for candidate in candidates:

            result = calculate_faculty_match(
                candidate,
                context
            )

            actual_research_areas = (
                candidate.get("research_areas") or []
            )

            relevant_publications = (
                result["relevant_publications"]
            )

            # ------------------------------------------------
            # FACULTY PHOTOGRAPH
            # ------------------------------------------------

            faculty_id = (
                candidate.get("faculty_id")
                or candidate.get("id")
            )

            photo_url = None

            if (
                faculty_id
                and re.fullmatch(r"nm\d+", str(faculty_id))
            ):

                # Check whether a downloaded photograph exists.
                for extension in FACULTY_PHOTO_EXTENSIONS:

                    photo_path = (
                        FACULTY_PHOTO_DIR
                        / f"{faculty_id}.{extension}"
                    )

                    if photo_path.is_file():

                        photo_url = (
                            f"{request.host_url.rstrip('/')}"
                            f"/faculty-photos/{faculty_id}"
                        )

                        break

            ranked.append({
                "name": candidate.get("name"),
                "faculty_name": candidate.get("name"),

                # Existing frontend ID field plus explicit
                # faculty-specific aliases.
                "id": candidate.get("id"),
                "faculty_id": candidate.get("faculty_id"),

                "profile_url": candidate.get("profile_url"),

                # Faculty photograph URL.
                # Returns None if no local photograph exists.
                "photo_url": photo_url,

                "department": candidate.get("department"),
                "campus": candidate.get("campus"),

                # Preserve the actual expertise from Neo4j.
                "research_areas": actual_research_areas,
                "areas_of_expertise": actual_research_areas,
                "expertise": actual_research_areas,

                # Scoring and compatibility fields.
                "score": result["score"],
                "match_score": result["score"],
                "relevance_score": result["score"],
                "match_reason": result["match_reason"],
                "explanation": result["match_reason"],
                "matched_terms": result["matched_terms"],
                "core_coverage": result["core_coverage"],
                "supporting_coverage": (
                    result["supporting_coverage"]
                ),
                "research_area_coverage": (
                    result["research_area_coverage"]
                ),

                # Relevant publication evidence.
                "publications": relevant_publications,
                "papers": relevant_publications,
                "publication_count": len(
                    relevant_publications
                ),
                "relevant_publication_count": (
                    result["relevant_publication_count"]
                ),
                "total_publication_count": (
                    candidate.get("publication_count", 0)
                ),

                # Verification and source transparency.
                "verification_status": (
                    candidate.get("verification_status")
                ),
                "data_source": candidate.get("data_source"),

                # Retain compatibility with the previous response.
                # These are zero because citation metrics have not
                # been established for these PES Faculty records.
                "h_index": candidate.get("h_index", 0),
                "i10_index": candidate.get("i10_index", 0),
                "cited_by_count": candidate.get(
                    "cited_by_count", 0
                )
            })

        ranked.sort(
            key=lambda faculty: (
                faculty["score"],
                faculty["research_area_coverage"],
                faculty["relevant_publication_count"],
                faculty["total_publication_count"]
            ),
            reverse=True
        )

        # Return no recommendations if the graph contains no
        # faculty records. Otherwise return the three highest
        # scoring faculty members, even if their scores are low.
        top_faculty = ranked[:3]

        print()
        print("=" * 60)
        print("RESEARCHPILOT FACULTY MATCHING")
        print("=" * 60)
        print("Project:", context["project_title"])
        print("Faculty records retrieved:", len(candidates))
        print("Faculty scored:", len(ranked))
        print("Returned:", len(top_faculty))

        for position, faculty in enumerate(
            top_faculty,
            start=1
        ):
            print(
                f"{position}. {faculty['name']} "
                f"- {faculty['score']}%"
            )

            print(
                "   Photograph:",
                faculty["photo_url"] or "Not available"
            )

        print("=" * 60)

        return jsonify({
            "status": "success",
            "project_title": context["project_title"],
            "faculty_count": len(top_faculty),

            # Main frontend response key.
            "faculty_recommendations": top_faculty,

            # Compatibility aliases.
            "recommendations": top_faculty,
            "faculty": top_faculty,

            "matching_method": (
                "Algorithmic lexical matching of project context "
                "against the dedicated PES faculty research areas "
                "and FacultyPublication records. Scores combine "
                "core-context coverage, supporting-context coverage, "
                "research-area overlap and relevant publication "
                "evidence. No LLM is used for ranking."
            ),

            "message": (
                "Faculty ranked successfully."
                if top_faculty
                else "No PES faculty records were found in Neo4j."
            )
        }), 200

    except Exception as e:
        print(
            "Faculty recommendation error:",
            repr(e)
        )

        return jsonify({
            "error": "Faculty recommendation failed.",
            "details": str(e),
            "faculty_recommendations": [],
            "recommendations": [],
            "faculty": []
        }), 500

print("PHOTO DIRECTORY:", FACULTY_PHOTO_DIR)
print("DIRECTORY EXISTS:", FACULTY_PHOTO_DIR.exists())
print("NM1060 FILES:", list(FACULTY_PHOTO_DIR.glob("nm1060.*")))

# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":

    print()
    print("=" * 70)
    print("RESEARCHPILOT BACKEND")
    print("=" * 70)

    print(
        "Neo4j URI:",
        URI
    )

    print(
        "Ollama URL:",
        OLLAMA_URL
    )

    print(
        "Ollama model:",
        OLLAMA_MODEL
    )

    print("=" * 70)

    # --------------------------------------------------------
    # TEST NEO4J CONNECTION
    # --------------------------------------------------------

    try:

        with get_driver() as driver:
            driver.verify_connectivity()

        print(
            "Neo4j connection: OK"
        )

    except Exception as e:

        print(
            "Neo4j connection failed:"
        )

        print(
            str(e)
        )

    # --------------------------------------------------------
    # PROFILE MIGRATION
    # --------------------------------------------------------

    repair_existing_users()

    print()
    print(
        "Starting Flask server..."
    )
    print()

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )