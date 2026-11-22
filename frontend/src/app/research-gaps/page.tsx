
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Network,
  AlertCircle,
  BookOpen,
  UserRound,
} from 'lucide-react';

// ============================================================
// API
// ============================================================

const API_URL = 'http://127.0.0.1:5000';

// ============================================================
// TYPES
// ============================================================

type ResearchPaper = {
  id?: string;
  title?: string;
  summary?: string;
  abstract?: string;
  authors?: {
    name: string;
    id: string;
  }[];
  url?: string;
  date?: string;
};

type ResearchGap = {
  gap_id: string;
  description: string;
  evidence: string;
  research_opportunity: string;
};

// ============================================================
// PAGE
// ============================================================

export default function ResearchGapsPage() {
  // ==========================================================
  // STATE
  // ==========================================================

  const [papers, setPapers] = useState<ResearchPaper[]>([]);
  const [gaps, setGaps] = useState<ResearchGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ==========================================================
  // STRICT MODE PROTECTION
  // ==========================================================

  const generationStartedRef = useRef(false);

  // ==========================================================
  // GET ABSTRACT
  // ==========================================================

  const getAbstract = (paper: ResearchPaper): string => {
    if (
      typeof paper.summary === 'string' &&
      paper.summary.trim().length > 0
    ) {
      return paper.summary.trim();
    }

    if (
      typeof paper.abstract === 'string' &&
      paper.abstract.trim().length > 0
    ) {
      return paper.abstract.trim();
    }

    return '';
  };

  // ==========================================================
  // RESEARCH GAP CACHE
  // ==========================================================

  const getGapCacheKey = (
    selectedPapers: ResearchPaper[]
  ): string => {
    const abstracts = selectedPapers
      .filter((paper) => getAbstract(paper).length > 0)
      .slice(0, 5)
      .map((paper) => getAbstract(paper));

    const signature = JSON.stringify(abstracts);

    // Deterministic hash for a compact localStorage key.
    let hash = 2166136261;

    for (let i = 0; i < signature.length; i++) {
      hash ^= signature.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    return `researchpilot:research-gaps:v1:${(
      hash >>> 0
    ).toString(16)}`;
  };

  // ==========================================================
  // GENERATE RESEARCH GAPS
  // ==========================================================

  const generateResearchGaps = async (
    selectedPapers: ResearchPaper[]
  ) => {
    setLoading(true);
    setError(null);
    setGaps([]);

    try {
      // ------------------------------------------------------
      // FIND USABLE PAPERS
      // ------------------------------------------------------

      const papersWithAbstracts = selectedPapers
        .filter((paper) => getAbstract(paper).length > 0)
        .slice(0, 5);

      // ------------------------------------------------------
      // REQUIRE AT LEAST ONE PAPER
      // ------------------------------------------------------

      if (papersWithAbstracts.length === 0) {
        throw new Error(
          'No selected research papers have usable abstracts. Please return to the recommendations page and try again.'
        );
      }

      // ------------------------------------------------------
      // STORE EXACT PAPERS
      // ------------------------------------------------------

      setPapers(papersWithAbstracts);

      sessionStorage.setItem(
        'researchGapPapers',
        JSON.stringify(papersWithAbstracts)
      );

      // ------------------------------------------------------
      // EXTRACT ABSTRACTS
      // ------------------------------------------------------

      const abstracts = papersWithAbstracts
        .map((paper) => getAbstract(paper))
        .filter((abstract) => abstract.trim().length > 0);

      if (abstracts.length === 0) {
        throw new Error(
          'No usable abstracts were found in the selected research papers.'
        );
      }

      // ------------------------------------------------------
      // DEBUG
      // ------------------------------------------------------

      console.log(
        '=================================================='
      );

      console.log('RESEARCHPILOT RESEARCH GAP REQUEST');
      console.log('Selected papers:', papersWithAbstracts);
      console.log('Usable paper count:', papersWithAbstracts.length);
      console.log('Abstract count:', abstracts.length);

      console.log(
        '=================================================='
      );

      // ------------------------------------------------------
      // BACKEND REQUEST
      // ------------------------------------------------------

      const gapResponse = await fetch(
        `${API_URL}/research-gap`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            abstracts,
          }),
        }
      );

      // ------------------------------------------------------
      // PARSE RESPONSE
      // ------------------------------------------------------

      let gapData: {
        research_gaps?: ResearchGap[];
        gaps?: ResearchGap[];
        gap_count?: number;
        error?: string;
        message?: string;
      };

      try {
        gapData = await gapResponse.json();
      } catch {
        throw new Error(
          'The backend returned an invalid response.'
        );
      }

      console.log('Research gap response:', gapData);

      // ------------------------------------------------------
      // BACKEND ERROR
      // ------------------------------------------------------

      if (!gapResponse.ok) {
        throw new Error(
          gapData.error ||
            gapData.message ||
            'Failed to generate research gaps.'
        );
      }

      // ------------------------------------------------------
      // SUPPORT BOTH RESPONSE FORMATS
      // ------------------------------------------------------

      const returnedGaps = Array.isArray(gapData.research_gaps)
        ? gapData.research_gaps
        : Array.isArray(gapData.gaps)
          ? gapData.gaps
          : null;

      if (!returnedGaps) {
        throw new Error(
          'The backend returned research gaps in an unexpected format.'
        );
      }

      // ------------------------------------------------------
      // REQUIRE FIVE GAPS
      // ------------------------------------------------------

      if (returnedGaps.length < 5) {
        throw new Error(
          `The backend returned only ${returnedGaps.length} research gaps. Five research gaps are required for the next stage.`
        );
      }

      // ------------------------------------------------------
      // NORMALIZE FIVE GAPS
      // ------------------------------------------------------

      const generatedGaps: ResearchGap[] = returnedGaps
        .slice(0, 5)
        .map((gap, index) => ({
          gap_id:
            typeof gap?.gap_id === 'string'
              ? gap.gap_id
              : `GAP_${index + 1}`,

          description:
            typeof gap?.description === 'string'
              ? gap.description.trim()
              : '',

          evidence:
            typeof gap?.evidence === 'string'
              ? gap.evidence.trim()
              : '',

          research_opportunity:
            typeof gap?.research_opportunity === 'string'
              ? gap.research_opportunity.trim()
              : '',
        }));

      // ------------------------------------------------------
      // VALIDATE
      // ------------------------------------------------------

      const validGaps = generatedGaps.filter(
        (gap) => gap.description.length > 0
      );

      if (validGaps.length !== 5) {
        throw new Error(
          'The backend returned incomplete research-gap information.'
        );
      }

      // ------------------------------------------------------
      // SAVE RESULTS
      // ------------------------------------------------------

      const cacheKey = getGapCacheKey(papersWithAbstracts);

      const abstractsSignature = JSON.stringify(abstracts);

      // Keep results in React state for the current page.
      setGaps(validGaps);
      setPapers(papersWithAbstracts);

      // Persist the generated analysis across page reloads.
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            abstractsSignature,
            papers: papersWithAbstracts,
            gaps: validGaps,
            savedAt: new Date().toISOString(),
          })
        );
      } catch (storageError) {
        console.warn(
          'Could not save research gap cache:',
          storageError
        );
      }

      // Preserve the existing handoff to Project Ideation.
      sessionStorage.setItem(
        'researchGaps',
        JSON.stringify(validGaps)
      );

      sessionStorage.setItem(
        'researchGapPapers',
        JSON.stringify(papersWithAbstracts)
      );

      console.log(
        `Successfully generated ${validGaps.length} research gaps from ${papersWithAbstracts.length} papers:`,
        validGaps
      );
    } catch (err) {
      console.error('Research gap generation error:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate research gaps.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // LOAD SELECTED PAPERS AND RESTORE CACHED GAPS
  // ==========================================================

  useEffect(() => {
    if (generationStartedRef.current) {
      console.log(
        'Research gap loading already started. Skipping duplicate effect execution.'
      );

      return;
    }

    generationStartedRef.current = true;

    const loadResearchGaps = async () => {
      try {
        const storedPapers = sessionStorage.getItem(
          'researchGapPapers'
        );

        if (!storedPapers) {
          setError(
            'No research papers were selected for research gap analysis. Please return to the recommendations page and try again.'
          );
          setLoading(false);
          return;
        }

        const parsedPapers: unknown = JSON.parse(storedPapers);

        if (!Array.isArray(parsedPapers)) {
          setError(
            'The selected research papers could not be loaded.'
          );
          setLoading(false);
          return;
        }

        const usablePapers = (
          parsedPapers as ResearchPaper[]
        )
          .filter((paper) => getAbstract(paper).length > 0)
          .slice(0, 5);

        if (usablePapers.length === 0) {
          setError(
            'No selected research papers have usable abstracts. Please return to the recommendations page and try again.'
          );
          setLoading(false);
          return;
        }

        // ----------------------------------------------------
        // CHECK FOR PREVIOUSLY GENERATED RESULTS
        // ----------------------------------------------------

        const abstracts = usablePapers.map((paper) =>
          getAbstract(paper)
        );

        const abstractsSignature = JSON.stringify(abstracts);

        const cacheKey = getGapCacheKey(usablePapers);

        try {
          const saved = localStorage.getItem(cacheKey);

          if (saved) {
            const cached = JSON.parse(saved);

            const cacheIsValid =
              cached.abstractsSignature === abstractsSignature &&
              Array.isArray(cached.papers) &&
              Array.isArray(cached.gaps) &&
              cached.gaps.length === 5 &&
              cached.gaps.every(
                (gap: ResearchGap) =>
                  typeof gap?.description === 'string' &&
                  gap.description.trim().length > 0
              );

            if (cacheIsValid) {
              const cachedPapers: ResearchPaper[] = cached.papers;
              const cachedGaps: ResearchGap[] = cached.gaps;

              console.log(
                'Restored research gaps from localStorage.'
              );

              setPapers(cachedPapers);
              setGaps(cachedGaps);
              setError(null);

              // Maintain compatibility with Project Ideation.
              sessionStorage.setItem(
                'researchGapPapers',
                JSON.stringify(cachedPapers)
              );

              sessionStorage.setItem(
                'researchGaps',
                JSON.stringify(cachedGaps)
              );

              setLoading(false);
              return;
            }
          }
        } catch (cacheError) {
          console.warn(
            'Could not restore research gap cache:',
            cacheError
          );
        }

        // ----------------------------------------------------
        // NO VALID CACHE: GENERATE NEW RESEARCH GAPS
        // ----------------------------------------------------

        console.log(
          'No matching cached research gaps found. Generating new results.'
        );

        await generateResearchGaps(usablePapers);
      } catch (err) {
        console.error('Failed to load research papers:', err);

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load the selected research papers.'
        );

        setLoading(false);
      }
    };

    loadResearchGaps();

    // Strict Mode protection is handled by the ref above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================================
  // CREATE PROJECT IDEAS
  // ==========================================================

  const handleCreateProjectIdeas = () => {
    if (gaps.length !== 5) {
      setError(
        'Five research gaps are required before creating project ideas.'
      );

      return;
    }

    if (papers.length === 0) {
      setError(
        'At least one research paper is required before creating project ideas.'
      );

      return;
    }

    sessionStorage.setItem(
      'researchGaps',
      JSON.stringify(gaps)
    );

    sessionStorage.setItem(
      'researchGapPapers',
      JSON.stringify(papers)
    );

    window.location.href = '/project-ideas';
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="border-b border-slate-200 bg-white">
        <div
          className="
            relative mx-auto flex h-20 w-full max-w-7xl
            items-center justify-between px-6 md:px-8
          "
        >
          <Link
            href="/recommendations"
            className="
              inline-flex items-center gap-2 text-sm font-medium
              text-slate-500 transition hover:text-slate-900
            "
          >
            <ArrowLeft className="h-4 w-4" />
            Recommendations
          </Link>

          <Link
            href="/recommendation-type"
            className="
              absolute left-1/2 hidden -translate-x-1/2
              text-center sm:block
            "
          >
            <div className="text-lg font-semibold tracking-tight text-slate-900">
              RESEARCHPILOT
            </div>

            <div className="text-[11px] text-slate-400">
              Research discovery &amp; guidance
            </div>
          </Link>

          <Link
            href="/account_view?returnTo=/research-gaps"
            aria-label="Profile"
            title="Profile"
            className="
              inline-flex shrink-0 items-center justify-center gap-2
              rounded-lg border border-slate-200 bg-white
              px-3 py-2 text-sm font-medium text-slate-700
              transition hover:bg-slate-50 hover:text-slate-900
            "
          >
            <UserRound className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </Link>
        </div>
      </header>

      {/* ======================================================
          MAIN
      ====================================================== */}

      <div
        className="
          mx-auto
          w-full
          max-w-6xl
          px-6
          py-10
          md:px-8
          md:py-14
        "
      >

        {/* ====================================================
            WORKFLOW PROGRESS
        ==================================================== */}

        <div
          className="
            mb-8
            flex
            flex-wrap
            items-center
            justify-center
            gap-x-2
            gap-y-3
          "
        >
          <div
            className="
              flex items-center gap-2 text-xs
              font-medium text-slate-400
            "
          >
            <span
              className="
                flex h-7 w-7 items-center justify-center
                rounded-full border border-slate-200
                bg-white text-xs
              "
            >
              1
            </span>
            Research Profile
          </div>

          <div className="h-px w-5 bg-slate-200 sm:w-8" />

          <div
            className="
              flex items-center gap-2 text-xs
              font-medium text-slate-400
            "
          >
            <span
              className="
                flex h-7 w-7 items-center justify-center
                rounded-full border border-slate-200
                bg-white text-xs
              "
            >
              2
            </span>
            Paper Recommendations
          </div>

          <div className="h-px w-5 bg-slate-200 sm:w-8" />

          <div
            className="
              flex items-center gap-2 text-xs
              font-medium text-slate-900
            "
          >
            <span
              className="
                flex h-7 w-7 items-center justify-center
                rounded-full bg-slate-900
                text-xs text-white
              "
            >
              3
            </span>
            Research Gaps
          </div>

          <div className="h-px w-5 bg-slate-200 sm:w-8" />

          <div
            className="
              flex items-center gap-2 text-xs
              font-medium text-slate-400
            "
          >
            <span
              className="
                flex h-7 w-7 items-center justify-center
                rounded-full border border-slate-200
                bg-white text-xs
              "
            >
              4
            </span>
            Project Ideas
          </div>

          <div className="h-px w-5 bg-slate-200 sm:w-8" />

          <div
            className="
              flex items-center gap-2 text-xs
              font-medium text-slate-400
            "
          >
            <span
              className="
                flex h-7 w-7 items-center justify-center
                rounded-full border border-slate-200
                bg-white text-xs
              "
            >
              5
            </span>
            Faculty Assignment
          </div>

          <div className="h-px w-5 bg-slate-200 sm:w-8" />

          <div
            className="
              flex items-center gap-2 text-xs
              font-medium text-slate-400
            "
          >
            <span
              className="
                flex h-7 w-7 items-center justify-center
                rounded-full border border-slate-200
                bg-white text-xs
              "
            >
              6
            </span>
            Final Dashboard
          </div>
        </div>

        {/* ====================================================
            PAGE INTRO
        ==================================================== */}

        <div className="mb-10 text-center">
          <div
            className="
              mb-4 flex items-center justify-center gap-2
            "
          >
            <div
              className="
                flex h-9 w-9 items-center justify-center
                rounded-lg bg-slate-900 text-white
              "
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : error ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <Network className="h-4 w-4" />
              )}
            </div>

            <span
              className="
                text-xs font-semibold uppercase
                tracking-wider text-slate-400
              "
            >
              Research gap analysis
            </span>
          </div>

          <div
            className="
              flex flex-col items-center justify-center gap-6
            "
          >
            <div className="mx-auto max-w-3xl">
              <h1
                className="
                  text-3xl font-semibold tracking-tight
                  text-slate-900 md:text-4xl
                "
              >
                Research Gap Identification
              </h1>

              <p
                className="
                  mx-auto mt-3 max-w-2xl text-sm
                  leading-6 text-slate-500 md:text-base
                "
              >
                Analyze the selected literature to identify
                potential areas where existing research may
                be incomplete, limited, or open to further
                investigation.
              </p>
            </div>

            {!loading && !error && gaps.length === 5 && (
              <div
                className="
                  inline-flex shrink-0 items-center gap-2
                  rounded-full border border-emerald-200
                  bg-emerald-50 px-3.5 py-2
                  text-xs font-medium text-emerald-700
                "
              >
                <CheckCircle2 className="h-4 w-4" />
                Analysis complete
              </div>
            )}
          </div>
        </div>

        {/* ====================================================
            PAPERS CONTEXT
        ==================================================== */}

        {papers.length > 0 && (
          <section
            className="
              mb-8 rounded-2xl border border-slate-200
              bg-white shadow-sm
            "
          >
            <div
              className="
                flex flex-col gap-4 border-b border-slate-100
                px-6 py-5 sm:flex-row sm:items-center
                sm:justify-between md:px-7
              "
            >
              <div className="flex items-center gap-3">
                <div
                  className="
                    flex h-10 w-10 items-center justify-center
                    rounded-xl bg-slate-100 text-slate-600
                  "
                >
                  <BookOpen className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Literature being analyzed
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-400">
                    {papers.length}{' '}
                    {papers.length === 1 ? 'paper' : 'papers'}{' '}
                    selected from your recommendations
                  </p>
                </div>
              </div>

              <span
                className="
                  inline-flex w-fit items-center rounded-full
                  bg-slate-50 px-3 py-1.5 text-xs
                  font-medium text-slate-500
                "
              >
                Source literature
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {papers.map((paper, index) => (
                <div
                  key={paper.id || `paper-${index}`}
                  className="
                    flex items-start gap-4
                    px-6 py-4 md:px-7
                  "
                >
                  <div
                    className="
                      mt-0.5 flex h-7 w-7 shrink-0
                      items-center justify-center rounded-lg
                      bg-slate-100 text-xs font-semibold
                      text-slate-500
                    "
                  >
                    {index + 1}
                  </div>

                  <p className="text-sm leading-6 text-slate-600">
                    {paper.title || 'Research Paper'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ====================================================
            LOADING
        ==================================================== */}

        {loading && (
          <section
            className="
              rounded-2xl border border-slate-200
              bg-white p-8 shadow-sm md:p-10
            "
          >
            <div className="text-center">
              <div
                className="
                  mx-auto flex h-14 w-14 items-center
                  justify-center rounded-2xl bg-slate-100
                "
              >
                <Loader2 className="h-6 w-6 animate-spin text-slate-700" />
              </div>

              <h2 className="mt-5 text-xl font-semibold text-slate-900">
                Identifying research gaps
              </h2>

              <p
                className="
                  mx-auto mt-2 max-w-xl text-sm
                  leading-6 text-slate-500
                "
              >
                The selected abstracts are being analyzed
                to identify potential gaps and research
                opportunities.
              </p>

              <p className="mt-4 text-xs font-medium text-slate-400">
                This analysis may take a little time.
              </p>
            </div>

            <div
              className="
                mx-auto mt-8 h-1 max-w-md overflow-hidden
                rounded-full bg-slate-100
              "
            >
              <div
                className="
                  h-full w-1/2 animate-pulse
                  rounded-full bg-slate-800
                "
              />
            </div>
          </section>
        )}

        {/* ====================================================
            ERROR
        ==================================================== */}

        {!loading && error && (
          <section
            className="
              rounded-2xl border border-red-200
              bg-white p-8 shadow-sm md:p-10
            "
          >
            <div
              className="
                mx-auto flex max-w-2xl flex-col
                items-center text-center
              "
            >
              <div
                className="
                  flex h-12 w-12 items-center justify-center
                  rounded-xl bg-red-50 text-red-500
                "
              >
                <AlertCircle className="h-6 w-6" />
              </div>

              <h2 className="mt-5 text-xl font-semibold text-slate-900">
                Could not generate research gaps
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {error}
              </p>

              <Link
                href="/recommendations"
                className="
                  mt-6 inline-flex items-center gap-2
                  rounded-lg bg-slate-900 px-5 py-2.5
                  text-sm font-medium text-white
                  transition hover:bg-slate-800
                "
              >
                <ArrowLeft className="h-4 w-4" />
                Return to Recommendations
              </Link>
            </div>
          </section>
        )}

        {/* ====================================================
            RESULTS
        ==================================================== */}

        {!loading && !error && gaps.length === 5 && (
          <div className="space-y-8">

            {/* =================================================
                RESULTS HEADER AND GAP CARDS
            ================================================= */}

            <section
              className="
                rounded-2xl border border-slate-200
                bg-white shadow-sm
              "
            >
              <div
                className="
                  flex flex-col gap-4 border-b
                  border-slate-100 px-6 py-6 md:px-7
                "
              >
                <div className="flex items-start gap-4">
                  <div
                    className="
                      flex h-11 w-11 shrink-0
                      items-center justify-center rounded-xl
                      bg-slate-900 text-white
                    "
                  >
                    <Network className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      Identified Research Gaps
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Five potential research gaps identified
                      from {papers.length}{' '}
                      {papers.length === 1
                        ? 'selected paper'
                        : 'selected papers'}.
                    </p>
                  </div>
                </div>
              </div>

              {/* ===============================================
                  GAP CARDS
              =============================================== */}

              <div className="divide-y divide-slate-100">
                {gaps.map((gap, index) => (
                  <article
                    key={gap.gap_id || `gap-${index}`}
                    className="px-6 py-7 md:px-7"
                  >
                    {/* GAP NUMBER AND TITLE */}

                    <div className="flex items-start gap-4">
                      <div
                        className="
                          flex h-10 w-10 shrink-0
                          items-center justify-center rounded-xl
                          bg-slate-100 text-sm font-semibold
                          text-slate-700
                        "
                      >
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div
                          className="
                            flex h-10 items-center
                            text-sm font-semibold text-slate-500
                          "
                        >
                          Gap {index + 1}
                        </div>

                        <h3
                          className="
                            whitespace-pre-wrap break-words
                            text-lg font-semibold leading-7
                            text-slate-900
                          "
                        >
                          {gap.description}
                        </h3>
                      </div>
                    </div>

                    {/* GAP DETAILS */}

                    <div
                      className="
                        mt-6 grid gap-4 md:grid-cols-2
                      "
                    >
                      {/* EVIDENCE */}

                      <div
                        className="
                          rounded-xl border border-slate-200
                          bg-slate-50 p-5
                        "
                      >
                        <div className="mb-3 flex items-center gap-2">
                          <div
                            className="
                              h-1.5 w-1.5 rounded-full
                              bg-slate-400
                            "
                          />

                          <p
                            className="
                              text-xs font-semibold uppercase
                              tracking-wider text-slate-500
                            "
                          >
                            Evidence from Literature
                          </p>
                        </div>

                        <p
                          className="
                            whitespace-pre-wrap break-words
                            text-sm leading-7 text-slate-600
                          "
                        >
                          {gap.evidence ||
                            'Evidence was not separately specified.'}
                        </p>
                      </div>

                      {/* OPPORTUNITY */}

                      <div
                        className="
                          rounded-xl border border-slate-200
                          bg-white p-5
                        "
                      >
                        <div className="mb-3 flex items-center gap-2">
                          <div
                            className="
                              h-1.5 w-1.5 rounded-full
                              bg-slate-800
                            "
                          />

                          <p
                            className="
                              text-xs font-semibold uppercase
                              tracking-wider text-slate-500
                            "
                          >
                            Research Opportunity
                          </p>
                        </div>

                        <p
                          className="
                            whitespace-pre-wrap break-words
                            text-sm leading-7 text-slate-600
                          "
                        >
                          {gap.research_opportunity ||
                            'Further investigation may be possible in this area.'}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* =================================================
                NEXT STEP
            ================================================= */}

            <section
              className="
                overflow-hidden rounded-2xl border
                border-slate-200 bg-slate-900
                text-white shadow-sm
              "
            >
              <div
                className="
                  flex flex-col gap-7 p-7
                  md:flex-row md:items-center
                  md:justify-between md:p-8
                "
              >
                <div className="max-w-2xl">
                  <div className="mb-3 flex items-center gap-2">
                    <div
                      className="
                        flex h-8 w-8 items-center justify-center
                        rounded-lg bg-white/10
                      "
                    >
                      <Lightbulb className="h-4 w-4" />
                    </div>

                    <span
                      className="
                        text-xs font-semibold uppercase
                        tracking-wider text-slate-300
                      "
                    >
                      Next stage
                    </span>
                  </div>

                  <h2 className="text-xl font-semibold md:text-2xl">
                    Turn research gaps into project ideas
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Use these identified gaps together with
                    the selected literature to develop
                    distinct and feasible project directions.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCreateProjectIdeas}
                  className="
                    inline-flex shrink-0 items-center
                    justify-center gap-2 rounded-lg
                    bg-white px-5 py-3 text-sm font-medium
                    text-slate-900 transition hover:bg-slate-100
                  "
                >
                  <Lightbulb className="h-4 w-4" />
                  Create Project Ideas
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>

            {/* =================================================
                VALIDATION NOTE
            ================================================= */}

            <div
              className="
                rounded-xl border border-slate-200
                bg-white px-5 py-4
              "
            >
              <p className="text-xs leading-5 text-slate-400">
                These identified gaps represent potential
                areas for further investigation. They should
                be validated against the original research
                literature before being used as the basis
                for a research project.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
