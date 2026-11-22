"""
RESEARCHPILOT - Algorithmic Research Gap Identification

This module identifies research gaps from a collection of academic
paper abstracts using deterministic textual analysis.

No LLM or external AI model is used here.

Pipeline:
    Recommended Papers
            ↓
    Abstract / Summary Extraction
            ↓
    Evidence Detection
            ↓
    Gap Classification
            ↓
    Evidence Scoring
            ↓
    Cross-Paper Deduplication
            ↓
    Top Research Gaps
"""

import re
from collections import Counter
from typing import Any, Dict, List


# ============================================================
# GAP INDICATORS
# ============================================================

GAP_PATTERNS = {
    "methodological_limitation": [
        "limitation",
        "limitations",
        "limited",
        "limit",
        "restricted",
        "restriction",
        "constraint",
        "constraints",
        "drawback",
        "drawbacks",
    ],

    "future_research": [
        "future work",
        "future research",
        "further research",
        "further studies",
        "future studies",
        "should be investigated",
        "should be explored",
        "needs further investigation",
        "requires further investigation",
        "warrants further investigation",
        "warrants further study",
        "remain for future work",
        "left for future work",
    ],

    "unresolved_problem": [
        "unresolved",
        "remains unclear",
        "remains unknown",
        "not well understood",
        "poorly understood",
        "unknown",
        "not fully understood",
        "not completely understood",
        "remains an open problem",
        "open problem",
    ],

    "research_challenge": [
        "challenge",
        "challenges",
        "difficulty",
        "difficulties",
        "challenging",
        "problem",
        "problems",
        "barrier",
        "barriers",
    ],

    "research_gap": [
        "lack of",
        "lack",
        "insufficient",
        "inadequate",
        "scarce",
        "few studies",
        "few researchers",
        "little research",
        "limited research",
        "limited studies",
        "underexplored",
        "under-explored",
        "under studied",
        "under-studied",
        "under investigated",
        "under-investigated",
        "little is known",
        "not enough research",
    ],

    "uncertainty": [
        "uncertain",
        "uncertainty",
        "inconclusive",
        "inconsistent",
        "controversial",
        "mixed results",
        "mixed findings",
        "conflicting results",
        "conflicting findings",
    ],
}


# Priority used when a sentence contains multiple categories.
CATEGORY_PRIORITY = {
    "methodological_limitation": 7,
    "future_research": 6,
    "research_gap": 5,
    "unresolved_problem": 4,
    "uncertainty": 3,
    "research_challenge": 2,
    "general": 1,
}


# ============================================================
# TEXT CLEANING
# ============================================================

def clean_text(text: Any) -> str:
    """
    Normalize arbitrary text into a clean string.
    """

    if text is None:
        return ""

    text = str(text)

    text = text.replace("\n", " ")
    text = text.replace("\r", " ")
    text = text.replace("\t", " ")

    text = re.sub(r"\s+", " ", text)

    return text.strip()


# ============================================================
# SENTENCE SPLITTING
# ============================================================

def split_sentences(text: str) -> List[str]:
    """
    Split text into reasonably meaningful sentences.

    This intentionally remains lightweight so that the module
    does not require an NLP model.
    """

    text = clean_text(text)

    if not text:
        return []

    sentences = re.split(
        r"(?<=[.!?])\s+",
        text
    )

    cleaned = []

    for sentence in sentences:
        sentence = sentence.strip()

        if len(sentence) >= 20:
            cleaned.append(sentence)

    return cleaned


# ============================================================
# INDICATOR DETECTION
# ============================================================

def find_matching_categories(sentence: str) -> Dict[str, List[str]]:
    """
    Find which research-gap categories are represented in a sentence.
    """

    sentence_lower = sentence.lower()

    matches: Dict[str, List[str]] = {}

    for category, patterns in GAP_PATTERNS.items():

        matched_patterns = []

        for pattern in patterns:

            if pattern.lower() in sentence_lower:
                matched_patterns.append(pattern)

        if matched_patterns:
            matches[category] = matched_patterns

    return matches


# ============================================================
# GAP CLASSIFICATION
# ============================================================

def classify_gap(categories: List[str]) -> str:
    """
    Select the strongest gap category when multiple categories
    occur in the same sentence.
    """

    if not categories:
        return "general"

    return max(
        categories,
        key=lambda category: CATEGORY_PRIORITY.get(
            category,
            0
        )
    )


# ============================================================
# EVIDENCE SCORING
# ============================================================

def score_evidence(
    sentence: str,
    categories: List[str],
    paper_index: int = 0
) -> float:
    """
    Calculate a deterministic evidence score.

    The score is not a machine-learning confidence score.

    It rewards:
      - stronger gap categories
      - multiple gap indicators
      - sentences explicitly discussing future research
      - sentences discussing limitations
      - useful sentence length
    """

    score = 0.0

    # Strong category weighting.
    category_weights = {
        "future_research": 5.0,
        "methodological_limitation": 4.5,
        "research_gap": 4.0,
        "unresolved_problem": 3.8,
        "uncertainty": 3.3,
        "research_challenge": 3.0,
        "general": 1.0,
    }

    for category in categories:
        score += category_weights.get(
            category,
            1.0
        )

    # Multiple indicators make the evidence stronger.
    if len(categories) >= 2:
        score += 2.0

    if len(categories) >= 3:
        score += 1.0

    sentence_lower = sentence.lower()

    # Explicit future-oriented language.
    future_terms = [
        "future research",
        "future work",
        "further research",
        "further studies",
        "should be investigated",
        "should be explored",
        "requires further investigation",
        "needs further investigation",
    ]

    if any(term in sentence_lower for term in future_terms):
        score += 3.0

    # Explicit limitation language.
    limitation_terms = [
        "limitation",
        "limitations",
        "constraint",
        "constraints",
        "restricted",
    ]

    if any(term in sentence_lower for term in limitation_terms):
        score += 2.0

    # Prefer reasonably informative sentences.
    word_count = len(sentence.split())

    if 20 <= word_count <= 80:
        score += 1.5

    elif 10 <= word_count < 20:
        score += 0.5

    elif word_count > 80:
        score += 0.5

    # Very small deterministic adjustment based on source paper.
    # This prevents ties from always favoring the same position.
    score += max(0, 0.05 - (paper_index * 0.001))

    return round(score, 3)


# ============================================================
# GAP DESCRIPTION
# ============================================================

def generate_gap_description(
    category: str,
    evidence_sentence: str
) -> str:

    descriptions = {

        "methodological_limitation":
            "The literature indicates a methodological or experimental limitation that may require further investigation.",

        "future_research":
            "The literature explicitly identifies an area requiring additional research or further investigation.",

        "research_gap":
            "The literature indicates insufficient research, evidence, or coverage in this area.",

        "unresolved_problem":
            "The literature indicates that an important research problem remains unresolved or insufficiently understood.",

        "uncertainty":
            "The available findings are uncertain, inconsistent, or inconclusive, indicating an opportunity for further investigation.",

        "research_challenge":
            "The literature identifies a research challenge that may provide an opportunity for further investigation.",

        "general":
            "The literature contains evidence of an area that may require additional research.",
    }

    return descriptions.get(
        category,
        descriptions["general"]
    )


# ============================================================
# RESEARCH OPPORTUNITY
# ============================================================

def generate_research_opportunity(
    category: str,
    evidence_sentence: str
) -> str:

    opportunities = {

        "methodological_limitation":
            "A future study could investigate alternative methods, datasets, experimental settings, or evaluation strategies to address the identified limitation.",

        "future_research":
            "A focused study could investigate the area explicitly identified for further research and evaluate it under a well-defined research setting.",

        "research_gap":
            "A research study could address the lack of evidence by examining the under-explored area with a defined dataset, methodology, or experimental framework.",

        "unresolved_problem":
            "A research project could investigate the unresolved issue and determine the conditions, mechanisms, or approaches that may explain it.",

        "uncertainty":
            "A comparative or experimental study could investigate the inconsistent findings and determine which conditions lead to different outcomes.",

        "research_challenge":
            "A research project could develop and evaluate an approach specifically targeted at the identified challenge.",

        "general":
            "Further investigation could be conducted to determine whether the identified issue represents a meaningful opportunity for new research.",
    }

    return opportunities.get(
        category,
        opportunities["general"]
    )


# ============================================================
# CANDIDATE EXTRACTION
# ============================================================

def extract_gap_candidates(
    paper: Dict[str, Any],
    paper_index: int
) -> List[Dict[str, Any]]:
    """
    Extract candidate research gaps from one paper.
    """

    title = clean_text(
        paper.get("title", "")
    )

    abstract = clean_text(
        paper.get("abstract")
        or paper.get("summary")
        or ""
    )

    if not abstract:
        return []

    sentences = split_sentences(abstract)

    candidates = []

    for sentence_index, sentence in enumerate(sentences):

        category_matches = find_matching_categories(
            sentence
        )

        if not category_matches:
            continue

        categories = list(
            category_matches.keys()
        )

        category = classify_gap(
            categories
        )

        score = score_evidence(
            sentence,
            categories,
            paper_index
        )

        candidates.append({
            "paper_index": paper_index + 1,
            "paper_id": paper.get("id"),
            "paper_title": title,
            "sentence_index": sentence_index,
            "evidence": sentence,
            "categories": categories,
            "matched_indicators": [
                indicator
                for indicators in category_matches.values()
                for indicator in indicators
            ],
            "category": category,
            "score": score,
        })

    return candidates


# ============================================================
# TEXT SIMILARITY / DEDUPLICATION
# ============================================================

def normalize_for_comparison(text: str) -> set:
    """
    Convert a sentence into a set of normalized content words.
    """

    text = clean_text(text).lower()

    words = re.findall(
        r"[a-zA-Z0-9]+",
        text
    )

    stop_words = {
        "the",
        "a",
        "an",
        "and",
        "or",
        "of",
        "to",
        "in",
        "on",
        "for",
        "with",
        "is",
        "are",
        "was",
        "were",
        "this",
        "that",
        "these",
        "those",
        "may",
        "can",
        "could",
        "should",
        "be",
        "by",
        "as",
        "from",
    }

    return {
        word
        for word in words
        if word not in stop_words
        and len(word) > 2
    }


def calculate_jaccard_similarity(
    first: str,
    second: str
) -> float:

    first_set = normalize_for_comparison(
        first
    )

    second_set = normalize_for_comparison(
        second
    )

    if not first_set or not second_set:
        return 0.0

    intersection = len(
        first_set & second_set
    )

    union = len(
        first_set | second_set
    )

    if union == 0:
        return 0.0

    return intersection / union


def is_duplicate_gap(
    candidate: Dict[str, Any],
    selected: List[Dict[str, Any]]
) -> bool:
    """
    Determine whether a candidate is substantially similar
    to an already-selected gap.
    """

    candidate_text = candidate.get(
        "evidence",
        ""
    )

    for existing in selected:

        existing_text = existing.get(
            "evidence",
            ""
        )

        similarity = calculate_jaccard_similarity(
            candidate_text,
            existing_text
        )

        if similarity >= 0.72:
            return True

        candidate_category = candidate.get(
            "category"
        )

        existing_category = existing.get(
            "category"
        )

        if (
            candidate_category == existing_category
            and similarity >= 0.58
        ):
            return True

    return False


# ============================================================
# FALLBACK GAP GENERATION
# ============================================================

def create_fallback_gap(
    paper: Dict[str, Any],
    paper_index: int,
    existing_categories: Counter
) -> Dict[str, Any]:
    """
    Create a deterministic fallback opportunity when the
    available abstracts do not contain enough explicit
    research-gap indicator sentences.

    This does NOT invent a specific factual claim.
    It states that the available literature provides an
    opportunity for additional investigation.
    """

    title = clean_text(
        paper.get("title", "")
    )

    abstract = clean_text(
        paper.get("abstract")
        or paper.get("summary")
        or ""
    )

    sentences = split_sentences(
        abstract
    )

    # Prefer a reasonably informative sentence.
    evidence = ""

    if sentences:
        ranked_sentences = sorted(
            sentences,
            key=lambda sentence: len(
                sentence.split()
            ),
            reverse=True
        )

        evidence = ranked_sentences[0]

    category = "general"

    # Use a category that has not dominated the
    # existing output when possible.
    category_options = [
        "research_gap",
        "research_challenge",
        "uncertainty",
        "unresolved_problem",
        "methodological_limitation",
    ]

    category = min(
        category_options,
        key=lambda value:
            existing_categories.get(value, 0)
    )

    return {
        "paper_index": paper_index + 1,
        "paper_id": paper.get("id"),
        "paper_title": title,
        "evidence": evidence,
        "categories": [category],
        "matched_indicators": [],
        "category": category,
        "score": 1.0,
        "fallback": True,
    }


# ============================================================
# SINGLE-PAPER COMPATIBILITY FUNCTION
# ============================================================

def analyze_single_paper(
    title: str,
    abstract: str
) -> Dict[str, Any]:
    """
    Preserve compatibility with the older single-paper API.
    """

    paper = {
        "id": None,
        "title": title,
        "abstract": abstract,
    }

    candidates = extract_gap_candidates(
        paper,
        0
    )

    candidates.sort(
        key=lambda item: item["score"],
        reverse=True
    )

    gaps = []

    for index, candidate in enumerate(
        candidates
    ):

        gaps.append({
            "gap_id": f"GAP_{index + 1}",
            "description": generate_gap_description(
                candidate["category"],
                candidate["evidence"]
            ),
            "evidence": candidate["evidence"],
            "research_opportunity":
                generate_research_opportunity(
                    candidate["category"],
                    candidate["evidence"]
                ),
            "category": candidate["category"],
            "paper_title": candidate["paper_title"],
            "score": candidate["score"],
        })

    return {
        "paper_title": clean_text(title),
        "gap_count": len(gaps),
        "gaps": gaps,
        "analysis_status":
            "gaps_identified"
            if gaps
            else "no_explicit_gaps_detected",
    }


# ============================================================
# MULTI-PAPER GAP IDENTIFICATION
# ============================================================

def identify_research_gaps(
    papers=None,
    title: str = "",
    abstract: str = ""
) -> Dict[str, Any]:
    """
    Main research-gap function.

    Preferred input:
        papers=[
            {
                "id": "...",
                "title": "...",
                "abstract": "..."
            },
            ...
        ]

    Compatibility input:
        title="..."
        abstract="..."

    The algorithm:
        1. Validate usable papers.
        2. Extract evidence sentences.
        3. Classify each candidate.
        4. Score each candidate.
        5. Remove near-duplicates.
        6. Select strongest candidates.
        7. Add deterministic fallback opportunities if needed.
        8. Return up to five structured research gaps.
    """

    # --------------------------------------------------------
    # BACKWARD COMPATIBILITY
    # --------------------------------------------------------

    if papers is None:

        if title or abstract:

            return analyze_single_paper(
                title,
                abstract
            )

        return {
            "paper_count": 0,
            "gap_count": 0,
            "gaps": [],
            "analysis_status":
                "no_usable_papers",
        }

    # --------------------------------------------------------
    # NORMALIZE PAPERS
    # --------------------------------------------------------

    if not isinstance(
        papers,
        list
    ):
        papers = []

    normalized_papers = []

    for paper in papers:

        if not isinstance(
            paper,
            dict
        ):
            continue

        paper_title = clean_text(
            paper.get("title", "")
        )

        paper_abstract = clean_text(
            paper.get("abstract")
            or paper.get("summary")
            or ""
        )

        if not paper_abstract:
            continue

        normalized_papers.append({
            "id": paper.get("id"),
            "title": paper_title
                or f"Research Paper {len(normalized_papers) + 1}",
            "abstract": paper_abstract,
        })

    # Use at most five papers for this stage.
    normalized_papers = normalized_papers[:5]

    if not normalized_papers:

        return {
            "paper_count": 0,
            "gap_count": 0,
            "gaps": [],
            "analysis_status":
                "no_usable_papers",
        }

    # --------------------------------------------------------
    # EXTRACT ALL CANDIDATES
    # --------------------------------------------------------

    all_candidates = []

    for index, paper in enumerate(
        normalized_papers
    ):

        candidates = extract_gap_candidates(
            paper,
            index
        )

        all_candidates.extend(
            candidates
        )

    # --------------------------------------------------------
    # SORT CANDIDATES
    # --------------------------------------------------------

    all_candidates.sort(
        key=lambda item: (
            item.get("score", 0),
            len(
                item.get(
                    "categories",
                    []
                )
            ),
        ),
        reverse=True
    )

    # --------------------------------------------------------
    # SELECT DIVERSE TOP GAPS
    # --------------------------------------------------------

    selected_candidates = []

    selected_paper_ids = set()

    selected_categories = Counter()

    # First pass:
    # Prefer diversity across papers and categories.
    for candidate in all_candidates:

        if len(
            selected_candidates
        ) >= 5:
            break

        if is_duplicate_gap(
            candidate,
            selected_candidates
        ):
            continue

        category = candidate.get(
            "category",
            "general"
        )

        paper_id = candidate.get(
            "paper_id"
        )

        # Give a slight preference to a new paper,
        # while still allowing multiple strong gaps
        # from one paper.
        if (
            paper_id is not None
            and paper_id in selected_paper_ids
            and len(selected_candidates) < min(
                3,
                len(normalized_papers)
            )
        ):
            continue

        selected_candidates.append(
            candidate
        )

        selected_categories[
            category
        ] += 1

        if paper_id is not None:
            selected_paper_ids.add(
                paper_id
            )

    # Second pass:
    # Fill remaining slots with strongest candidates.
    if len(selected_candidates) < 5:

        for candidate in all_candidates:

            if len(
                selected_candidates
            ) >= 5:
                break

            if candidate in selected_candidates:
                continue

            if is_duplicate_gap(
                candidate,
                selected_candidates
            ):
                continue

            selected_candidates.append(
                candidate
            )

            selected_categories[
                candidate.get(
                    "category",
                    "general"
                )
            ] += 1

    # --------------------------------------------------------
    # FALLBACKS
    # --------------------------------------------------------

    if len(selected_candidates) < 5:

        used_papers = {
            candidate.get("paper_id")
            for candidate in selected_candidates
        }

        # Prefer one fallback per paper first.
        for paper_index, paper in enumerate(
            normalized_papers
        ):

            if len(
                selected_candidates
            ) >= 5:
                break

            if paper.get("id") in used_papers:
                continue

            fallback = create_fallback_gap(
                paper,
                paper_index,
                selected_categories
            )

            if is_duplicate_gap(
                fallback,
                selected_candidates
            ):
                continue

            selected_candidates.append(
                fallback
            )

            selected_categories[
                fallback["category"]
            ] += 1

            used_papers.add(
                paper.get("id")
            )

    # Final fallback pass if fewer than five
    # papers are available.
    if len(selected_candidates) < 5:

        for paper_index, paper in enumerate(
            normalized_papers
        ):

            if len(
                selected_candidates
            ) >= 5:
                break

            fallback = create_fallback_gap(
                paper,
                paper_index,
                selected_categories
            )

            # Make the fallback sufficiently distinct.
            fallback["score"] = max(
                0.5,
                fallback["score"]
                - (
                    len(selected_candidates)
                    * 0.01
                )
            )

            selected_candidates.append(
                fallback
            )

            selected_categories[
                fallback["category"]
            ] += 1

    # --------------------------------------------------------
    # BUILD FINAL OUTPUT
    # --------------------------------------------------------

    gaps = []

    for index, candidate in enumerate(
        selected_candidates[:5]
    ):

        category = candidate.get(
            "category",
            "general"
        )

        evidence = candidate.get(
            "evidence",
            ""
        )

        gaps.append({
            "gap_id": f"GAP_{index + 1}",

            "description":
                generate_gap_description(
                    category,
                    evidence
                ),

            "evidence":
                evidence,

            "research_opportunity":
                generate_research_opportunity(
                    category,
                    evidence
                ),

            "category":
                category,

            "paper_title":
                candidate.get(
                    "paper_title",
                    ""
                ),

            "paper_index":
                candidate.get(
                    "paper_index"
                ),

            "matched_indicators":
                candidate.get(
                    "matched_indicators",
                    []
                ),

            "score":
                candidate.get(
                    "score",
                    0
                ),
        })

    return {
        "paper_count":
            len(normalized_papers),

        "papers_analyzed": [
            {
                "id": paper.get("id"),
                "title": paper.get("title"),
            }
            for paper in normalized_papers
        ],

        "gap_count":
            len(gaps),

        "gaps":
            gaps,

        "analysis_status":
            "gaps_identified"
            if gaps
            else "no_gaps_identified",
    }


# ============================================================
# ALIAS FOR API / APP COMPATIBILITY
# ============================================================

def analyze_research_papers(
    papers: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Convenience wrapper for the Flask application.
    """

    return identify_research_gaps(
        papers=papers
    )


# ============================================================
# LOCAL TEST
# ============================================================

if __name__ == "__main__":

    sample_papers = [
        {
            "id": "paper_1",
            "title": "Machine Learning for Medical Diagnosis",
            "abstract": (
                "Machine learning has been widely applied "
                "to medical diagnosis. However, the study "
                "has limitations related to dataset size "
                "and generalizability. Future research "
                "should investigate larger and more diverse "
                "clinical datasets."
            ),
        },

        {
            "id": "paper_2",
            "title": "Deep Learning in Healthcare",
            "abstract": (
                "Deep learning provides promising results "
                "for healthcare applications. However, "
                "results remain inconsistent across datasets "
                "and the reasons for this variation remain "
                "unclear. Further research is required."
            ),
        },

        {
            "id": "paper_3",
            "title": "Explainable Medical AI",
            "abstract": (
                "Explainability remains a challenge in "
                "clinical machine learning systems. There "
                "is little research evaluating explanation "
                "methods across different clinical settings."
            ),
        },
    ]

    result = identify_research_gaps(
        papers=sample_papers
    )

    import json

    print(
        json.dumps(
            result,
            indent=2
        )
    )