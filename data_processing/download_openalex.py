"""RESEARCHPILOT: Download a multidisciplinary set of OpenAlex papers.

Downloads metadata and abstract indexes (not PDFs) into the existing
 data_processing/final_sample JSON layout. Existing records are preserved and
 merged by OpenAlex ID. Computer Science and AI receives the largest quota.

Optional environment variables:
  OPENALEX_API_KEY  OpenAlex API key, if required by your account/API access
  OPENALEX_MAILTO   Email address for polite pool identification (optional)
"""
from __future__ import annotations

import json
import os
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Any

import requests

BASE_URL = "https://api.openalex.org/works"
DATA_DIR = Path(__file__).resolve().parent / "final_sample"
TARGET_NEW_PAPERS = 200
PER_PAGE = 100
MAX_PAGES_PER_QUERY = 4
MAX_RETRIES = 5
REQUEST_TIMEOUT = 45
PAUSE_SECONDS = 0.25
API_KEY = os.getenv("OPENALEX_API_KEY", "").strip()
MAILTO = os.getenv("OPENALEX_MAILTO", "").strip()

# Quotas sum to 200. CS/AI is deliberately the majority (60%).
RESEARCH_AREAS = [
    ("Computer Science and AI", 120, [
        "artificial intelligence machine learning",
        "natural language processing large language models",
        "knowledge graphs semantic web",
        "recommender systems information retrieval",
        "computer vision image processing",
        "cybersecurity privacy",
        "software engineering software testing",
        "data mining big data",
        "human computer interaction",
        "robotics autonomous systems",
    ]),
    ("Engineering and Technology", 25, [
        "electrical engineering smart grids",
        "electronics embedded systems",
        "mechanical engineering materials manufacturing",
        "civil engineering structural engineering",
        "renewable energy engineering",
    ]),
    ("Medicine and Health Sciences", 15, [
        "medical diagnosis clinical research",
        "public health disease prevention",
        "medical imaging healthcare technology",
    ]),
    ("Biology and Life Sciences", 10, [
        "molecular biology genetics",
        "microbiology biotechnology",
        "ecology biodiversity",
    ]),
    ("Business and Economics", 10, [
        "economics financial markets",
        "business management innovation",
        "supply chain operations research",
    ]),
    ("Psychology and Cognitive Science", 5, [
        "psychology cognitive science learning",
        "human behaviour decision making",
    ]),
    ("Environmental and Earth Sciences", 5, [
        "climate change environmental science",
        "water resources pollution",
    ]),
    ("Physics and Mathematics", 5, [
        "applied mathematics optimization",
        "physics materials quantum",
    ]),
    ("Education and Social Sciences", 5, [
        "education learning technology",
        "social sciences urban studies",
    ]),
]

SELECT_FIELDS = ",".join([
    "id", "doi", "display_name", "publication_date", "publication_year",
    "language", "type", "cited_by_count", "abstract_inverted_index",
    "authorships", "concepts", "topics", "primary_topic",
    "primary_location", "open_access",
])


def normalized_id(value: Any) -> str:
    return str(value or "").strip().rstrip("/").rsplit("/", 1)[-1]


def load_json(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
        raise ValueError(f"Expected a JSON list in {path}")
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise RuntimeError(f"Cannot safely read {path}: {exc}. No files were changed.") from exc


def save_json(path: Path, data: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    with temp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    temp.replace(path)


def merge_by_id(old: list[dict[str, Any]], new: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge by OpenAlex ID, retaining existing non-empty values."""
    merged: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for record in old + new:
        rid = normalized_id(record.get("id"))
        if not rid:
            # Do not merge unrelated records which happen to lack an ID.
            rid = f"__missing_id_{len(order)}"
        if rid not in merged:
            merged[rid] = dict(record)
            order.append(rid)
            continue
        target = merged[rid]
        for key, value in record.items():
            current = target.get(key)
            if current in (None, "", [], {}):
                if value not in (None, "", [], {}):
                    target[key] = value
            elif key in ("concepts", "topics", "authorships") and isinstance(current, list) and isinstance(value, list):
                seen = {
                    normalized_id(item.get("id")) if isinstance(item, dict) else str(item)
                    for item in current
                }
                for item in value:
                    item_id = normalized_id(item.get("id")) if isinstance(item, dict) else str(item)
                    if item_id and item_id not in seen:
                        current.append(item)
                        seen.add(item_id)
    return [merged[k] for k in order]


def reconstruct_abstract(index: Any) -> str:
    """Rebuild plaintext from OpenAlex's abstract_inverted_index."""
    if not isinstance(index, dict) or not index:
        return ""
    positions: dict[int, str] = {}
    for word, locations in index.items():
        if isinstance(locations, list):
            for pos in locations:
                if isinstance(pos, int) and pos >= 0:
                    positions.setdefault(pos, str(word))
    return " ".join(positions[pos] for pos in sorted(positions))


def has_abstract(work: dict[str, Any]) -> bool:
    return bool(reconstruct_abstract(work.get("abstract_inverted_index")).strip()) or bool(
        isinstance(work.get("abstract"), str) and work["abstract"].strip()
    )


def fetch_page(query: str, page: int) -> list[dict[str, Any]]:
    params: dict[str, Any] = {
        "search": query,
        "filter": "has_abstract:true,type:article",
        "sort": "relevance_score:desc",
        "per-page": PER_PAGE,
        "page": page,
        "select": SELECT_FIELDS,
    }
    if API_KEY:
        params["api_key"] = API_KEY
    if MAILTO:
        params["mailto"] = MAILTO

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(
                BASE_URL, params=params,
                headers={"User-Agent": "RESEARCHPILOT-multidisciplinary-downloader/1.0"},
                timeout=REQUEST_TIMEOUT,
            )
            if response.status_code == 429 or 500 <= response.status_code < 600:
                delay = min(2 ** attempt, 30)
                print(f"    HTTP {response.status_code}; retrying in {delay}s ({attempt}/{MAX_RETRIES})")
                time.sleep(delay)
                continue
            if response.status_code in (401, 403):
                raise RuntimeError(
                    "OpenAlex returned 401/403. Check API access. If you have an OpenAlex API key, "
                    "set OPENALEX_API_KEY in this terminal and rerun."
                )
            response.raise_for_status()
            payload = response.json()
            return [x for x in payload.get("results", []) if isinstance(x, dict)]
        except RuntimeError:
            raise
        except (requests.RequestException, ValueError) as exc:
            if attempt == MAX_RETRIES:
                print(f"    Request failed after {MAX_RETRIES} attempts: {exc}")
                return []
            delay = min(2 ** attempt, 30)
            print(f"    Request error: {exc}; retrying in {delay}s")
            time.sleep(delay)
    return []


def collect_related_records(works: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], ...]:
    authors: list[dict[str, Any]] = []
    institutions: list[dict[str, Any]] = []
    concepts: list[dict[str, Any]] = []
    topics: list[dict[str, Any]] = []
    affiliations_by_author: dict[str, dict[str, dict[str, Any]]] = {}

    for work in works:
        for authorship in work.get("authorships") or []:
            if not isinstance(authorship, dict):
                continue
            author = authorship.get("author") or {}
            if not isinstance(author, dict) or not author.get("id"):
                continue
            author_key = normalized_id(author["id"])
            authors.append({
                "id": author["id"],
                "display_name": author.get("display_name") or "Unknown author",
                "orcid": author.get("orcid"),
                "works_count": 0,
                "cited_by_count": 0,
                "last_known_institutions": [],
                "affiliations": [],
                "x_concepts": [],
            })
            for inst in authorship.get("institutions") or []:
                if not isinstance(inst, dict) or not inst.get("id"):
                    continue
                inst_record = {
                    "id": inst["id"],
                    "display_name": inst.get("display_name") or "Unknown institution",
                    "country_code": inst.get("country_code"),
                    "type": inst.get("type"),
                }
                institutions.append(inst_record)
                affiliations_by_author.setdefault(author_key, {})[normalized_id(inst["id"])] = inst_record

        for concept in work.get("concepts") or []:
            if isinstance(concept, dict) and concept.get("id"):
                concepts.append({
                    "id": concept["id"],
                    "display_name": concept.get("display_name") or "Unknown concept",
                    "level": concept.get("level"),
                    "score": concept.get("score"),
                    "wikidata": concept.get("wikidata"),
                    "description": concept.get("description"),
                })
        for topic in (work.get("topics") or []) + ([work["primary_topic"]] if isinstance(work.get("primary_topic"), dict) else []):
            if isinstance(topic, dict) and topic.get("id"):
                topics.append({
                    "id": topic["id"],
                    "display_name": topic.get("display_name") or "Unknown topic",
                    "subfield": topic.get("subfield"),
                    "field": topic.get("field"),
                    "domain": topic.get("domain"),
                    "score": topic.get("score"),
                })

    # Accumulate affiliations across every downloaded work, not just the last one.
    for author in authors:
        affiliations = list(affiliations_by_author.get(normalized_id(author.get("id")), {}).values())
        author["last_known_institutions"] = affiliations
        author["affiliations"] = [{"institution": inst, "years": []} for inst in affiliations]

    return authors, institutions, concepts, topics


def main() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    paths = {
        "works": DATA_DIR / "works.json",
        "authors": DATA_DIR / "authors.json",
        "concepts": DATA_DIR / "concepts.json",
        "topics": DATA_DIR / "topics.json",
        # Existing load_database.py uses this misspelled filename; keep it compatible.
        "institutions": DATA_DIR / "instituions.json",
    }
    existing = {name: load_json(path) for name, path in paths.items()}
    existing_work_ids = {normalized_id(w.get("id")) for w in existing["works"] if normalized_id(w.get("id"))}
    downloaded: list[dict[str, Any]] = []
    downloaded_ids: set[str] = set()
    area_counts: Counter[str] = Counter()

    print("=" * 72)
    print("RESEARCHPILOT — multidisciplinary OpenAlex downloader")
    print(f"Output folder: {DATA_DIR}")
    print(f"Existing work records: {len(existing['works'])}")
    print(f"Target: {TARGET_NEW_PAPERS} NEW unique papers with abstracts")
    print(f"API key configured: {'yes' if API_KEY else 'no'}")
    print("PDFs will not be downloaded.")
    print("=" * 72)

    for area_name, quota, queries in RESEARCH_AREAS:
        if len(downloaded) >= TARGET_NEW_PAPERS:
            break
        area_added = 0
        print(f"\n[{area_name}] target {quota}")
        for query in queries:
            if area_added >= quota or len(downloaded) >= TARGET_NEW_PAPERS:
                break
            print(f"  Searching: {query}")
            for page in range(1, MAX_PAGES_PER_QUERY + 1):
                if area_added >= quota or len(downloaded) >= TARGET_NEW_PAPERS:
                    break
                results = fetch_page(query, page)
                added = 0
                for work in results:
                    wid = normalized_id(work.get("id"))
                    if not wid or wid in existing_work_ids or wid in downloaded_ids:
                        continue
                    if not work.get("display_name") or not has_abstract(work):
                        continue
                    abstract = reconstruct_abstract(work.get("abstract_inverted_index"))
                    if abstract:
                        work["abstract"] = abstract
                    work["researchpilot_category"] = area_name
                    downloaded.append(work)
                    downloaded_ids.add(wid)
                    area_counts[area_name] += 1
                    area_added += 1
                    added += 1
                    if area_added >= quota or len(downloaded) >= TARGET_NEW_PAPERS:
                        break
                print(f"    Page {page}: {len(results)} results, {added} accepted; area {area_added}/{quota}; total {len(downloaded)}/{TARGET_NEW_PAPERS}")
                if len(results) < PER_PAGE:
                    break
                time.sleep(PAUSE_SECONDS)
            time.sleep(PAUSE_SECONDS)
        if area_added < quota:
            print(f"  Category shortfall: {quota - area_added} paper(s).")

    # Do not write any JSON until the download/search phase has finished.
    final_works = merge_by_id(existing["works"], downloaded)
    new_authors, new_institutions, new_concepts, new_topics = collect_related_records(downloaded)
    final_authors = merge_by_id(existing["authors"], new_authors)
    final_institutions = merge_by_id(existing["institutions"], new_institutions)
    final_concepts = merge_by_id(existing["concepts"], new_concepts)
    final_topics = merge_by_id(existing["topics"], new_topics)

    save_json(paths["works"], final_works)
    save_json(paths["authors"], final_authors)
    save_json(paths["institutions"], final_institutions)
    save_json(paths["concepts"], final_concepts)
    save_json(paths["topics"], final_topics)

    manifest = [{
        "source": "OpenAlex API",
        "target_new_papers": TARGET_NEW_PAPERS,
        "new_papers_downloaded": len(downloaded),
        "total_work_records_after_merge": len(final_works),
        "total_work_records_with_abstracts": sum(1 for w in final_works if has_abstract(w)),
        "new_papers_by_research_area": dict(area_counts),
        "note": "Metadata and abstracts only; no PDFs downloaded. Existing records preserved and merged by OpenAlex ID.",
    }]
    save_json(DATA_DIR / "download_manifest.json", manifest)

    print("\n" + "=" * 72)
    print("DOWNLOAD COMPLETE")
    print(f"New papers downloaded: {len(downloaded)}")
    print(f"Total work records now: {len(final_works)}")
    print(f"Work records with abstracts: {sum(1 for w in final_works if has_abstract(w))}")
    print("New papers by area:")
    for area_name, quota, _ in RESEARCH_AREAS:
        print(f"  {area_name}: {area_counts[area_name]}/{quota}")
    print("\nUpdated files:")
    for path in list(paths.values()) + [DATA_DIR / "download_manifest.json"]:
        print(f"  {path}")
    print("\nNext step: review the JSON files, then run load_database.py to import into Neo4j.")
    print("=" * 72)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nInterrupted. The JSON output files have not been rewritten.")
        raise SystemExit(130)
    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
