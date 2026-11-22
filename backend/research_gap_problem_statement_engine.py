
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from itertools import combinations
from math import log, sqrt
import json
import re
from typing import Any, Dict, Iterable, List, Mapping, Sequence, Set, Tuple


# ============================================================================
# MODULE 01 — CONFIGURATION
# ============================================================================

@dataclass(frozen=True)
class GapWeights:
    novelty: float = 0.35
    semantic: float = 0.25
    relevance: float = 0.25
    graph_support: float = 0.15


@dataclass(frozen=True)
class ProjectWeights:
    gap_alignment: float = 0.30
    method_suitability: float = 0.25
    dataset_availability: float = 0.20
    feasibility: float = 0.15
    coherence: float = 0.10


@dataclass(frozen=True)
class PrototypeConfig:
    gap_weights: GapWeights = GapWeights()
    project_weights: ProjectWeights = ProjectWeights()
    gap_candidate_limit: int = 5
    project_candidate_limit: int = 5


CONFIG = PrototypeConfig()


# ============================================================================
# MODULE 02 — DOMAIN MODELS
# ============================================================================

@dataclass(frozen=True)
class LiteratureItem:
    item_id: str
    title: str
    abstract: str
    concepts: Tuple[str, ...]
    methods: Tuple[str, ...]
    datasets: Tuple[str, ...]
    tasks: Tuple[str, ...]


@dataclass(frozen=True)
class GapCandidate:
    concept_a: str
    concept_b: str
    novelty: float
    semantic_compatibility: float
    user_relevance: float
    graph_support: float
    research_gap_score: float
    supporting_item_ids: Tuple[str, ...]


@dataclass(frozen=True)
class ProjectCandidate:
    gap_label: str
    method: str
    dataset: str
    task: str
    gap_alignment: float
    method_suitability: float
    dataset_availability: float
    feasibility: float
    coherence: float
    project_feasibility_score: float


@dataclass(frozen=True)
class GapEvidence:
    candidate: Mapping[str, Any]
    metrics: Mapping[str, float]
    formulas: Mapping[str, str]
    user_goal: str
    supporting_literature: Sequence[Mapping[str, Any]]


@dataclass(frozen=True)
class ProjectEvidence:
    domain: str
    existing_evidence: Mapping[str, Any]
    research_gap: str
    proposed_approach: Mapping[str, str]
    methodology: Mapping[str, Any]
    objective: str


# ============================================================================
# MODULE 03 — TEXT NORMALIZATION
# ============================================================================

STOPWORDS: Set[str] = {
    "a", "an", "and", "are", "as", "at", "be", "based", "by", "for",
    "from", "in", "into", "is", "of", "on", "or", "study", "that",
    "the", "their", "this", "through", "to", "under", "using", "with",
    "within", "work",
}


def tokenize(text: str) -> List[str]:
    """Normalize free text into comparable lexical tokens."""
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9_-]*", text.lower())
    return [token for token in tokens if token not in STOPWORDS]


def text_vector(text: str) -> Dict[str, float]:
    """Construct a simple term-frequency vector."""
    return dict(Counter(tokenize(text)))


def cosine_similarity(
    vector_a: Mapping[str, float],
    vector_b: Mapping[str, float],
) -> float:
    """
    Cosine similarity:

        S(A,B) = (A · B) / (||A|| ||B||)
    """
    shared = set(vector_a) & set(vector_b)
    numerator = sum(vector_a[t] * vector_b[t] for t in shared)

    norm_a = sqrt(sum(value * value for value in vector_a.values()))
    norm_b = sqrt(sum(value * value for value in vector_b.values()))

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    return numerator / (norm_a * norm_b)


def bounded(value: float) -> float:
    """Keep a score inside [0, 1]."""
    return max(0.0, min(1.0, value))


# ============================================================================
# MODULE 04 — LITERATURE REPRESENTATION
# ============================================================================

def represent_item(item: LiteratureItem) -> Dict[str, Any]:
    """
    P_i = {C_i, M_i, D_i, T_i}

    C_i = concepts
    M_i = methods
    D_i = datasets
    T_i = tasks
    """
    return {
        "item_id": item.item_id,
        "title": item.title,
        "C_i": list(item.concepts),
        "M_i": list(item.methods),
        "D_i": list(item.datasets),
        "T_i": list(item.tasks),
    }


def represent_corpus(
    literature: Sequence[LiteratureItem],
) -> List[Dict[str, Any]]:
    return [represent_item(item) for item in literature]


def concept_index(
    literature: Sequence[LiteratureItem],
) -> Dict[str, Set[str]]:
    index: Dict[str, Set[str]] = defaultdict(set)

    for item in literature:
        for concept in item.concepts:
            index[concept].add(item.item_id)

    return dict(index)


# ============================================================================
# MODULE 05 — TF-IDF EVIDENCE
# ============================================================================

def document_frequency(
    literature: Sequence[LiteratureItem],
) -> Dict[str, int]:
    frequencies: Counter[str] = Counter()

    for item in literature:
        unique_terms: Set[str] = set()

        for concept in item.concepts:
            unique_terms.update(tokenize(concept))

        for term in unique_terms:
            frequencies[term] += 1

    return dict(frequencies)


def corpus_tfidf(
    literature: Sequence[LiteratureItem],
) -> Dict[str, float]:
    """
    TFIDF(t,d) = TF(t,d) × IDF(t)

    IDF(t) = log(N / (df(t) + 1))
    """
    if not literature:
        return {}

    n_documents = len(literature)
    df = document_frequency(literature)
    aggregate: Dict[str, float] = defaultdict(float)

    for item in literature:
        terms: List[str] = []

        for concept in item.concepts:
            terms.extend(tokenize(concept))

        counts = Counter(terms)
        denominator = max(1, len(terms))

        for term, frequency in counts.items():
            tf = frequency / denominator
            idf = log(n_documents / (df.get(term, 0) + 1))
            aggregate[term] += tf * idf

    return dict(aggregate)


# ============================================================================
# MODULE 06 — CONCEPT GRAPH
# ============================================================================

def build_concept_graph(
    literature: Sequence[LiteratureItem],
) -> Dict[str, Set[str]]:
    """
    Construct an undirected concept graph.

    Two concepts are connected when they occur in the same literature item.
    """
    graph: Dict[str, Set[str]] = defaultdict(set)

    for item in literature:
        concepts = sorted(set(item.concepts))

        for left, right in combinations(concepts, 2):
            graph[left].add(right)
            graph[right].add(left)

    return dict(graph)


def jaccard_similarity(
    set_a: Set[str],
    set_b: Set[str],
) -> float:
    """
    J(A,B) = |A ∩ B| / |A ∪ B|
    """
    union = set_a | set_b

    if not union:
        return 0.0

    return len(set_a & set_b) / len(union)


def graph_support(
    concept_a: str,
    concept_b: str,
    graph: Mapping[str, Set[str]],
) -> float:
    return jaccard_similarity(
        graph.get(concept_a, set()),
        graph.get(concept_b, set()),
    )


# ============================================================================
# MODULE 07 — RESEARCH-GAP FEATURE ENGINEERING
# ============================================================================

def cooccurrence(
    concept_a: str,
    concept_b: str,
    literature: Sequence[LiteratureItem],
) -> float:
    """
    CoOccur(A,B) = N(A,B) / N

    N(A,B) = number of literature items containing both concepts.
    N      = total number of literature items.
    """
    if not literature:
        return 0.0

    count = sum(
        concept_a in item.concepts and concept_b in item.concepts
        for item in literature
    )

    return count / len(literature)


def novelty(
    concept_a: str,
    concept_b: str,
    literature: Sequence[LiteratureItem],
) -> float:
    """
    N(A,B) = 1 - CoOccur(A,B)

    This is interpreted as corpus-level under-exploration, not proof that
    a topic has never been studied anywhere.
    """
    return bounded(
        1.0 - cooccurrence(concept_a, concept_b, literature)
    )


def semantic_compatibility(
    concept_a: str,
    concept_b: str,
) -> float:
    return cosine_similarity(
        text_vector(concept_a),
        text_vector(concept_b),
    )


def user_goal_relevance(
    concept_a: str,
    concept_b: str,
    goal: str,
) -> float:
    """
    R(A,B) = Cosine(G, A+B)
    """
    return cosine_similarity(
        text_vector(goal),
        text_vector(f"{concept_a} {concept_b}"),
    )


# ============================================================================
# MODULE 08 — RESEARCH-GAP SCORING
# ============================================================================

def research_gap_score(
    novelty_score: float,
    semantic_score: float,
    relevance_score: float,
    graph_score: float,
    weights: GapWeights = CONFIG.gap_weights,
) -> float:
    """
    RGS =
        w_N N +
        w_S S +
        w_R R +
        w_U U
    """
    return bounded(
        weights.novelty * novelty_score
        + weights.semantic * semantic_score
        + weights.relevance * relevance_score
        + weights.graph_support * graph_score
    )


def generate_gap_candidates(
    literature: Sequence[LiteratureItem],
    goal: str,
    limit: int = CONFIG.gap_candidate_limit,
) -> List[GapCandidate]:
    """
    Generate and rank potential gap candidates without language generation.
    """
    graph = build_concept_graph(literature)
    index = concept_index(literature)

    concepts = sorted({
        concept
        for item in literature
        for concept in item.concepts
    })

    candidates: List[GapCandidate] = []

    for concept_a, concept_b in combinations(concepts, 2):
        n_score = novelty(concept_a, concept_b, literature)
        s_score = semantic_compatibility(concept_a, concept_b)
        r_score = user_goal_relevance(concept_a, concept_b, goal)
        u_score = graph_support(concept_a, concept_b, graph)

        score = research_gap_score(
            n_score,
            s_score,
            r_score,
            u_score,
        )

        evidence_ids = tuple(sorted(
            index.get(concept_a, set())
            | index.get(concept_b, set())
        ))

        candidates.append(
            GapCandidate(
                concept_a=concept_a,
                concept_b=concept_b,
                novelty=n_score,
                semantic_compatibility=s_score,
                user_relevance=r_score,
                graph_support=u_score,
                research_gap_score=score,
                supporting_item_ids=evidence_ids,
            )
        )

    candidates.sort(
        key=lambda candidate: candidate.research_gap_score,
        reverse=True,
    )

    return candidates[:limit]


# ============================================================================
# MODULE 09 — GAP EVIDENCE ASSEMBLY
# ============================================================================

def supporting_literature(
    candidate: GapCandidate,
    literature: Sequence[LiteratureItem],
    limit: int = 5,
) -> List[Dict[str, Any]]:
    target = {candidate.concept_a, candidate.concept_b}
    ranked: List[Tuple[int, LiteratureItem]] = []

    for item in literature:
        overlap = len(target & set(item.concepts))

        if overlap:
            ranked.append((overlap, item))

    ranked.sort(key=lambda pair: pair[0], reverse=True)

    return [
        {
            "item_id": item.item_id,
            "title": item.title,
            "abstract": item.abstract,
            "concepts": list(item.concepts),
            "methods": list(item.methods),
            "datasets": list(item.datasets),
            "tasks": list(item.tasks),
        }
        for _, item in ranked[:limit]
    ]


def assemble_gap_evidence(
    candidate: GapCandidate,
    literature: Sequence[LiteratureItem],
    goal: str,
) -> GapEvidence:
    return GapEvidence(
        candidate={
            "concept_A": candidate.concept_a,
            "concept_B": candidate.concept_b,
        },
        metrics={
            "N_novelty": round(candidate.novelty, 6),
            "S_semantic": round(candidate.semantic_compatibility, 6),
            "R_relevance": round(candidate.user_relevance, 6),
            "U_graph_support": round(candidate.graph_support, 6),
            "RGS": round(candidate.research_gap_score, 6),
        },
        formulas={
            "cooccurrence": "CoOccur(A,B) = N(A,B) / N",
            "novelty": "N(A,B) = 1 - CoOccur(A,B)",
            "semantic": "S(A,B) = (A · B) / (||A|| ||B||)",
            "graph_support": "U(A,B) = |N(A) ∩ N(B)| / |N(A) ∪ N(B)|",
            "relevance": "R(A,B) = Cosine(G, A+B)",
            "RGS": "RGS = 0.35N + 0.25S + 0.25R + 0.15U",
        },
        user_goal=goal,
        supporting_literature=supporting_literature(
            candidate,
            literature,
        ),
    )


# ============================================================================
# MODULE 10 — RESEARCH-GAP LANGUAGE REALIZATION
# ============================================================================

RESEARCH_GAP_PROMPT = """
ROLE
----
You are the language-realization layer of a research-analysis framework.

The analytical layer has already selected the candidate research-gap
configuration and calculated its evidence.

INPUT CONTRACT
--------------
The supplied JSON contains:
- candidate concepts;
- numerical research-gap metrics;
- the formulas used to obtain them;
- the user's research goal;
- supporting literature.

RULES
-----
1. Use only the supplied evidence.
2. Preserve the selected concepts.
3. Do not introduce a different candidate.
4. Do not invent papers, methods, datasets, results, or limitations.
5. Do not claim that a corpus-level observation proves a universal gap.
6. Express the result as a potential research gap within the analyzed
   literature.
7. Convert the structured evidence into concise academic prose.

OUTPUT
------
Research Gap:
<one concise academic paragraph>

Evidence Basis:
<short evidence-grounded explanation>
""".strip()


def build_gap_prompt(evidence: GapEvidence) -> str:
    payload = json.dumps(asdict(evidence), indent=2, ensure_ascii=False)

    return (
        f"{RESEARCH_GAP_PROMPT}\n\n"
        "================ INPUT EVIDENCE ================\n"
        f"{payload}\n\n"
        "================ TASK ================\n"
        "Formulate the potential research gap using only the supplied evidence."
    )


def realize_research_gap(
    evidence: GapEvidence,
) -> str:
    """
    Deterministic local realization for the standalone prototype.

    This function demonstrates the output contract without requiring a
    model service.
    """
    candidate = evidence.candidate
    metrics = evidence.metrics

    return (
        "Research Gap:\n"
        f"The analyzed literature indicates a potential under-explored "
        f"relationship between {candidate['concept_A']} and "
        f"{candidate['concept_B']} within the stated research objective. "
        f"The candidate obtained a corpus-level Research Gap Score of "
        f"{metrics['RGS']:.4f}, based on novelty, semantic compatibility, "
        f"user-goal relevance, and graph-structural support.\n\n"
        "Evidence Basis:\n"
        "The formulation is grounded in the supplied algorithmic metrics "
        "and supporting literature records."
    )


# ============================================================================
# MODULE 11 — PROJECT RESOURCE EXTRACTION
# ============================================================================

def available_methods(
    literature: Sequence[LiteratureItem],
) -> List[str]:
    return sorted({
        method
        for item in literature
        for method in item.methods
    })


def available_datasets(
    literature: Sequence[LiteratureItem],
) -> List[str]:
    return sorted({
        dataset
        for item in literature
        for dataset in item.datasets
    })


def available_tasks(
    literature: Sequence[LiteratureItem],
) -> List[str]:
    return sorted({
        task
        for item in literature
        for task in item.tasks
    })


# ============================================================================
# MODULE 12 — PROJECT FEATURE ENGINEERING
# ============================================================================

METHOD_LINKS: Dict[str, Set[str]] = {
    "Federated Learning": {
        "Federated Averaging",
        "Secure Aggregation",
    },
    "Privacy": {
        "Differential Privacy",
        "Secure Aggregation",
    },
    "Anomaly Detection": {
        "Random Forest",
        "Adaptive Learning",
    },
    "Edge Computing": {
        "Edge Inference",
        "Federated Averaging",
    },
    "Explainability": {
        "SHAP",
    },
}


def gap_alignment(
    candidate: GapCandidate,
    method: str,
    task: str,
) -> float:
    gap_text = f"{candidate.concept_a} {candidate.concept_b}"
    configuration_text = f"{method} {task}"

    lexical_alignment = cosine_similarity(
        text_vector(gap_text),
        text_vector(configuration_text),
    )

    return bounded(
        0.6 * candidate.research_gap_score
        + 0.4 * lexical_alignment
    )


def method_suitability(
    candidate: GapCandidate,
    method: str,
) -> float:
    gap_concepts = {
        candidate.concept_a,
        candidate.concept_b,
    }

    linked = any(
        method in METHOD_LINKS.get(concept, set())
        for concept in gap_concepts
    )

    lexical = cosine_similarity(
        text_vector(
            f"{candidate.concept_a} {candidate.concept_b}"
        ),
        text_vector(method),
    )

    link_score = 1.0 if linked else 0.0

    return bounded(
        0.5 * lexical + 0.5 * link_score
    )


def dataset_availability(
    dataset: str,
    literature: Sequence[LiteratureItem],
) -> float:
    occurrences = sum(
        dataset in item.datasets
        for item in literature
    )

    if occurrences == 0:
        return 0.0

    return bounded(occurrences / 2.0)


def configuration_feasibility(
    dataset: str,
    task: str,
) -> float:
    dataset_available = 1.0 if dataset else 0.0
    task_available = 1.0 if task else 0.0

    return 0.5 * dataset_available + 0.5 * task_available


def configuration_coherence(
    candidate: GapCandidate,
    method: str,
    dataset: str,
    task: str,
) -> float:
    gap_text = f"{candidate.concept_a} {candidate.concept_b}"
    configuration_text = f"{method} {dataset} {task}"

    return cosine_similarity(
        text_vector(gap_text),
        text_vector(configuration_text),
    )


# ============================================================================
# MODULE 13 — PROJECT FEASIBILITY SCORING
# ============================================================================

def project_feasibility_score(
    gap_alignment_score: float,
    method_score: float,
    dataset_score: float,
    feasibility_score: float,
    coherence_score: float,
    weights: ProjectWeights = CONFIG.project_weights,
) -> float:
    """
    PFS =
        0.30G +
        0.25M +
        0.20D +
        0.15F +
        0.10C
    """
    return bounded(
        weights.gap_alignment * gap_alignment_score
        + weights.method_suitability * method_score
        + weights.dataset_availability * dataset_score
        + weights.feasibility * feasibility_score
        + weights.coherence * coherence_score
    )


def generate_project_candidates(
    candidate: GapCandidate,
    literature: Sequence[LiteratureItem],
    limit: int = CONFIG.project_candidate_limit,
) -> List[ProjectCandidate]:
    methods = available_methods(literature)
    datasets = available_datasets(literature)
    tasks = available_tasks(literature)

    candidates: List[ProjectCandidate] = []

    for method in methods:
        for dataset in datasets:
            for task in tasks:
                g_score = gap_alignment(
                    candidate,
                    method,
                    task,
                )

                m_score = method_suitability(
                    candidate,
                    method,
                )

                d_score = dataset_availability(
                    dataset,
                    literature,
                )

                f_score = configuration_feasibility(
                    dataset,
                    task,
                )

                c_score = configuration_coherence(
                    candidate,
                    method,
                    dataset,
                    task,
                )

                pfs = project_feasibility_score(
                    g_score,
                    m_score,
                    d_score,
                    f_score,
                    c_score,
                )

                candidates.append(
                    ProjectCandidate(
                        gap_label=(
                            f"{candidate.concept_a} + "
                            f"{candidate.concept_b}"
                        ),
                        method=method,
                        dataset=dataset,
                        task=task,
                        gap_alignment=g_score,
                        method_suitability=m_score,
                        dataset_availability=d_score,
                        feasibility=f_score,
                        coherence=c_score,
                        project_feasibility_score=pfs,
                    )
                )

    candidates.sort(
        key=lambda candidate: candidate.project_feasibility_score,
        reverse=True,
    )

    return candidates[:limit]


# ============================================================================
# MODULE 14 — PROBLEM-STATEMENT STRUCTURE
# ============================================================================

def assemble_project_evidence(
    gap_candidate: GapCandidate,
    gap_text: str,
    project_candidate: ProjectCandidate,
    gap_evidence: GapEvidence,
) -> ProjectEvidence:
    """
    PS = {D, E, G, A, M, O}

    D = Domain
    E = Existing evidence
    G = Research gap
    A = Proposed approach
    M = Methodology
    O = Objective
    """
    return ProjectEvidence(
        domain=(
            f"{gap_candidate.concept_a} and "
            f"{gap_candidate.concept_b}"
        ),
        existing_evidence={
            "supporting_literature": gap_evidence.supporting_literature,
            "gap_metrics": gap_evidence.metrics,
        },
        research_gap=gap_text,
        proposed_approach={
            "method": project_candidate.method,
            "dataset": project_candidate.dataset,
            "task": project_candidate.task,
        },
        methodology={
            "representation": "X = {G, M, D, T}",
            "gap_alignment_G": round(
                project_candidate.gap_alignment,
                6,
            ),
            "method_suitability_M": round(
                project_candidate.method_suitability,
                6,
            ),
            "dataset_availability_D": round(
                project_candidate.dataset_availability,
                6,
            ),
            "feasibility_F": round(
                project_candidate.feasibility,
                6,
            ),
            "coherence_C": round(
                project_candidate.coherence,
                6,
            ),
            "PFS": round(
                project_candidate.project_feasibility_score,
                6,
            ),
        },
        objective=(
            "Investigate the selected potential research gap using the "
            "selected method, dataset, and task configuration."
        ),
    )


# ============================================================================
# MODULE 15 — PROJECT / PROBLEM-STATEMENT LANGUAGE REALIZATION
# ============================================================================

PROBLEM_STATEMENT_PROMPT = """
ROLE
----
You are the language-realization layer for project ideation.

The analytical layer has already selected the domain, research-gap
configuration, method, dataset, task, and project-scoring evidence.

INPUT CONTRACT
--------------
The supplied JSON follows:

    PS = {D, E, G, A, M, O}

where:
    D = Domain
    E = Existing evidence
    G = Research gap
    A = Proposed approach
    M = Methodology
    O = Objective

RULES
-----
1. Use only the supplied evidence.
2. Preserve the selected research gap.
3. Preserve the selected method.
4. Preserve the selected dataset.
5. Preserve the selected task.
6. Do not invent experimental results.
7. Do not invent literature findings.
8. Do not introduce unsupported technologies.
9. Do not replace the algorithmic configuration.
10. Convert the structured configuration into fluent academic language.

OUTPUT
------
Project Title:
<concise academic title>

Project Idea:
<academic project description>

Problem Statement:
<academic problem statement>

Objective:
<concise objective>
""".strip()


def build_problem_statement_prompt(
    evidence: ProjectEvidence,
) -> str:
    payload = json.dumps(asdict(evidence), indent=2, ensure_ascii=False)

    return (
        f"{PROBLEM_STATEMENT_PROMPT}\n\n"
        "================ INPUT EVIDENCE ================\n"
        f"{payload}\n\n"
        "================ TASK ================\n"
        "Generate the project title, project idea, problem statement, "
        "and objective using only the supplied configuration."
    )


def realize_project_description(
    evidence: ProjectEvidence,
) -> str:
    """
    Deterministic realization used by the standalone prototype.
    """
    approach = evidence.proposed_approach

    title = (
        f"Goal-Aware {approach['task']} using "
        f"{approach['method']}"
    )

    idea = (
        f"The project investigates the identified potential research gap "
        f"through {approach['task']} using {approach['method']} on the "
        f"{approach['dataset']}."
    )

    statement = (
        f"Within the analyzed literature, the selected relationship between "
        f"{evidence.domain} represents a potential under-explored direction. "
        f"The proposed project therefore investigates this direction using "
        f"{approach['method']} and the {approach['dataset']} for "
        f"{approach['task']}."
    )

    return (
        f"Project Title:\n{title}\n\n"
        f"Project Idea:\n{idea}\n\n"
        f"Problem Statement:\n{statement}\n\n"
        f"Objective:\n{evidence.objective}"
    )


# ============================================================================
# MODULE 16 — END-TO-END METHODOLOGY ORCHESTRATION
# ============================================================================

def run_methodology(
    recommended_literature: Sequence[LiteratureItem],
    research_goal: str,
) -> Dict[str, Any]:
    """
    Execute the complete analytical methodology after literature
    recommendation.

    The function does not access any external application state.
    """
    if not recommended_literature:
        raise ValueError("The literature collection cannot be empty.")

    # ---- Literature representation ----------------------------------------
    representation = represent_corpus(recommended_literature)
    tfidf = corpus_tfidf(recommended_literature)
    graph = build_concept_graph(recommended_literature)

    # ---- Research-gap generation ------------------------------------------
    gap_candidates = generate_gap_candidates(
        recommended_literature,
        research_goal,
    )

    if not gap_candidates:
        raise RuntimeError(
            "No candidate research gaps could be generated."
        )

    selected_gap = gap_candidates[0]

    gap_evidence = assemble_gap_evidence(
        selected_gap,
        recommended_literature,
        research_goal,
    )

    gap_prompt = build_gap_prompt(gap_evidence)
    gap_language = realize_research_gap(gap_evidence)

    # ---- Project generation -----------------------------------------------
    project_candidates = generate_project_candidates(
        selected_gap,
        recommended_literature,
    )

    if not project_candidates:
        raise RuntimeError(
            "No project configurations could be generated."
        )

    selected_project = project_candidates[0]

    project_evidence = assemble_project_evidence(
        selected_gap,
        gap_language,
        selected_project,
        gap_evidence,
    )

    project_prompt = build_problem_statement_prompt(
        project_evidence,
    )

    project_language = realize_project_description(
        project_evidence,
    )

    return {
        "research_goal": research_goal,
        "literature": {
            "representation": "P_i = {C_i, M_i, D_i, T_i}",
            "items": representation,
            "tfidf": tfidf,
            "concept_graph": {
                node: sorted(neighbors)
                for node, neighbors in graph.items()
            },
        },
        "research_gap": {
            "formulas": asdict(gap_evidence).get("formulas"),
            "candidates": [
                asdict(candidate)
                for candidate in gap_candidates
            ],
            "selected": asdict(selected_gap),
            "evidence": asdict(gap_evidence),
            "prompt": gap_prompt,
            "language_output": gap_language,
        },
        "project": {
            "representation": "X = {G, M, D, T}",
            "formula": (
                "PFS = 0.30G + 0.25M + 0.20D + 0.15F + 0.10C"
            ),
            "candidates": [
                asdict(candidate)
                for candidate in project_candidates
            ],
            "selected": asdict(selected_project),
            "evidence": asdict(project_evidence),
            "prompt": project_prompt,
            "language_output": project_language,
        },
        "problem_statement_structure": "PS = {D, E, G, A, M, O}",
    }


# ============================================================================
# MODULE 17 — TRACE / REPORTING
# ============================================================================

def print_methodology_report(
    result: Mapping[str, Any],
) -> None:
    line = "=" * 88

    print(line)
    print("SG-WRGPI METHODOLOGY PROTOTYPE")
    print(line)

    print("\nRESEARCH GOAL")
    print(result["research_goal"])

    print("\nLITERATURE REPRESENTATION")
    print("P_i = {C_i, M_i, D_i, T_i}")
    print("TFIDF(t,d) = TF(t,d) × IDF(t)")
    print("IDF(t) = log(N / (df(t) + 1))")

    print("\nRESEARCH-GAP SCORING")
    print("CoOccur(A,B) = N(A,B) / N")
    print("N(A,B) = 1 - CoOccur(A,B)")
    print("S(A,B) = (A · B) / (||A|| ||B||)")
    print("U(A,B) = |N(A) ∩ N(B)| / |N(A) ∪ N(B)|")
    print("R(A,B) = Cosine(G, A+B)")
    print("RGS = 0.35N + 0.25S + 0.25R + 0.15U")

    print("\nTOP RESEARCH-GAP CANDIDATES")
    for rank, candidate in enumerate(
        result["research_gap"]["candidates"],
        start=1,
    ):
        print(
            f"{rank}. "
            f"{candidate['concept_a']} + "
            f"{candidate['concept_b']} "
            f"| RGS={candidate['research_gap_score']:.4f}"
        )

    print("\nSELECTED RESEARCH-GAP EVIDENCE")
    print(json.dumps(
        result["research_gap"]["evidence"],
        indent=2,
        ensure_ascii=False,
    ))

    print("\nRESEARCH-GAP LANGUAGE INPUT")
    print("-" * 88)
    print(result["research_gap"]["prompt"])

    print("\nRESEARCH-GAP LANGUAGE OUTPUT")
    print("-" * 88)
    print(result["research_gap"]["language_output"])

    print("\nPROJECT SCORING")
    print("X = {G, M, D, T}")
    print("PFS = 0.30G + 0.25M + 0.20D + 0.15F + 0.10C")

    print("\nTOP PROJECT CONFIGURATIONS")
    for rank, candidate in enumerate(
        result["project"]["candidates"],
        start=1,
    ):
        print(
            f"{rank}. "
            f"Method={candidate['method']} | "
            f"Dataset={candidate['dataset']} | "
            f"Task={candidate['task']} | "
            f"PFS={candidate['project_feasibility_score']:.4f}"
        )

    print("\nPROBLEM-STATEMENT STRUCTURE")
    print("PS = {D, E, G, A, M, O}")

    print("\nPROJECT / PROBLEM-STATEMENT LANGUAGE INPUT")
    print("-" * 88)
    print(result["project"]["prompt"])

    print("\nPROJECT / PROBLEM-STATEMENT LANGUAGE OUTPUT")
    print("-" * 88)
    print(result["project"]["language_output"])

    print("\nPIPELINE")
    print("Recommended Literature")
    print("        ↓")
    print("P_i = {C_i, M_i, D_i, T_i}")
    print("        ↓")
    print("TF-IDF + Co-occurrence + Novelty")
    print("        ↓")
    print("Semantic Compatibility + Graph Support + User Relevance")
    print("        ↓")
    print("Research Gap Score (RGS)")
    print("        ↓")
    print("Selected Gap + Structured Evidence")
    print("        ↓")
    print("Research-Gap Language Realization")
    print("        ↓")
    print("Method + Dataset + Task Candidate Generation")
    print("        ↓")
    print("Project Feasibility Score (PFS)")
    print("        ↓")
    print("Selected Project Configuration")
    print("        ↓")
    print("PS = {D, E, G, A, M, O}")
    print("        ↓")
    print("Project / Problem-Statement Language Realization")

    print("\n" + line)
    print("END OF METHODOLOGY REPORT")
    print(line)


# ============================================================================
# MODULE 18 — SELF-CONTAINED LITERATURE FIXTURE
# ============================================================================

DEMONSTRATION_LITERATURE: Tuple[LiteratureItem, ...] = (
    LiteratureItem(
        item_id="LIT-001",
        title="Federated Learning for Resource-Constrained IoT Monitoring",
        abstract=(
            "Federated learning is investigated for distributed Internet "
            "of Things monitoring under communication and computation "
            "constraints."
        ),
        concepts=(
            "IoT",
            "Federated Learning",
            "Edge Computing",
            "Resource Constraints",
            "Privacy",
        ),
        methods=(
            "Federated Averaging",
            "Neural Network",
        ),
        datasets=(
            "IoT Telemetry Dataset",
        ),
        tasks=(
            "Anomaly Detection",
            "Distributed Classification",
        ),
    ),
    LiteratureItem(
        item_id="LIT-002",
        title="Privacy-Preserving Edge Analytics for Smart Sensors",
        abstract=(
            "Privacy-aware analytics at the edge are investigated for "
            "smart sensor networks with an emphasis on local computation."
        ),
        concepts=(
            "IoT",
            "Edge Computing",
            "Privacy",
            "Smart Sensors",
            "Distributed Analytics",
        ),
        methods=(
            "Differential Privacy",
            "Edge Inference",
        ),
        datasets=(
            "Smart Sensor Dataset",
        ),
        tasks=(
            "Privacy-Preserving Classification",
        ),
    ),
    LiteratureItem(
        item_id="LIT-003",
        title="Adaptive Anomaly Detection in Industrial IoT",
        abstract=(
            "An adaptive anomaly detection framework is evaluated on "
            "industrial IoT telemetry under changing operating conditions."
        ),
        concepts=(
            "IoT",
            "Anomaly Detection",
            "Industrial Systems",
            "Edge Computing",
            "Adaptive Learning",
        ),
        methods=(
            "Adaptive Learning",
            "Random Forest",
        ),
        datasets=(
            "Industrial IoT Dataset",
        ),
        tasks=(
            "Anomaly Detection",
            "Predictive Maintenance",
        ),
    ),
    LiteratureItem(
        item_id="LIT-004",
        title="Secure Collaborative Learning for Edge Devices",
        abstract=(
            "Collaborative learning across edge devices is examined using "
            "security and privacy mechanisms."
        ),
        concepts=(
            "Federated Learning",
            "Edge Computing",
            "Security",
            "Privacy",
            "Collaborative Learning",
        ),
        methods=(
            "Federated Averaging",
            "Secure Aggregation",
        ),
        datasets=(
            "Edge Device Dataset",
        ),
        tasks=(
            "Distributed Classification",
            "Secure Learning",
        ),
    ),
    LiteratureItem(
        item_id="LIT-005",
        title="Explainable Anomaly Detection for Sensor Networks",
        abstract=(
            "Explainable anomaly detection is investigated for sensor "
            "networks using interpretable prediction methods."
        ),
        concepts=(
            "Anomaly Detection",
            "Explainability",
            "Sensor Networks",
            "Interpretability",
            "IoT",
        ),
        methods=(
            "Random Forest",
            "SHAP",
        ),
        datasets=(
            "Sensor Network Dataset",
        ),
        tasks=(
            "Anomaly Detection",
            "Explainable Classification",
        ),
    ),
)


# ============================================================================
# MODULE 19 — ENTRY POINT
# ============================================================================

def main() -> None:
    research_goal = (
        "Develop practical privacy-preserving intelligent IoT systems "
        "using federated learning and edge computing for anomaly detection."
    )

    result = run_methodology(
        recommended_literature=DEMONSTRATION_LITERATURE,
        research_goal=research_goal,
    )

    print_methodology_report(result)


if __name__ == "__main__":
    main()
