'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  CircleDot,
  FileText,
  Lightbulb,
  Loader2,
  Target,
  Wrench,
  ExternalLink,
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
  gap_id?: string;
  description?: string;
  evidence?: string;
  research_opportunity?: string;
  category?: string;
};

type ProjectIdea = {
  idea_id?: string;
  title?: string;
  problem_statement?: string;
  research_gap?: string;
  gap_category?: string;
  proposed_approach?: string;
  recommended_technologies?: string[];
  relevance?: string;
  difficulty?: string;
  evaluation?: string;
  expected_outcome?: string;
  email?: string;

  // Preserve additional fields returned by the backend.
  [key: string]: unknown;
};

// ============================================================
// HELPERS
// ============================================================

function getPaperAbstract(paper: ResearchPaper): string {
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
}

function normalizePaper(paper: ResearchPaper): ResearchPaper {
  const abstract = getPaperAbstract(paper);

  return {
    ...paper,
    summary: abstract,
    abstract,
  };
}

// ============================================================
// EXTRACT PROJECT IDEAS
// ============================================================

function extractProjectIdeas(data: unknown): ProjectIdea[] {
  if (Array.isArray(data)) {
    return data as ProjectIdea[];
  }

  if (data && typeof data === 'object') {
    const response = data as Record<string, unknown>;

    const possibleKeys = [
      'ideas',
      'project_ideas',
      'projectIdeas',
      'results',
      'projects',
      'research_projects',
      'items',
    ];

    for (const key of possibleKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value as ProjectIdea[];
      }
    }

    const nestedKeys = ['data', 'result', 'response', 'output'];

    for (const key of nestedKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value as ProjectIdea[];
      }

      if (value && typeof value === 'object') {
        const nestedIdeas = extractProjectIdeas(value);

        if (nestedIdeas.length > 0) {
          return nestedIdeas;
        }
      }
    }
  }

  return [];
}

// ============================================================
// NORMALIZE PROJECT IDEA
// ============================================================

function normalizeProjectIdea(
  idea: ProjectIdea,
  index: number
): ProjectIdea {
  return {
    ...idea,

    idea_id:
      typeof idea.idea_id === 'string' && idea.idea_id.trim()
        ? idea.idea_id.trim()
        : `idea-${index + 1}`,

    title:
      typeof idea.title === 'string'
        ? idea.title.trim()
        : `Project Idea ${index + 1}`,

    problem_statement:
      typeof idea.problem_statement === 'string'
        ? idea.problem_statement.trim()
        : '',

    research_gap:
      typeof idea.research_gap === 'string'
        ? idea.research_gap.trim()
        : '',

    gap_category:
      typeof idea.gap_category === 'string'
        ? idea.gap_category.trim()
        : '',

    proposed_approach:
      typeof idea.proposed_approach === 'string'
        ? idea.proposed_approach.trim()
        : '',

    recommended_technologies:
      Array.isArray(idea.recommended_technologies)
        ? idea.recommended_technologies
            .filter(
              (technology): technology is string =>
                typeof technology === 'string'
            )
            .map((technology) => technology.trim())
            .filter(Boolean)
        : [],

    relevance:
      typeof idea.relevance === 'string'
        ? idea.relevance.trim()
        : '',

    difficulty:
      typeof idea.difficulty === 'string'
        ? idea.difficulty.trim()
        : '',

    evaluation:
      typeof idea.evaluation === 'string'
        ? idea.evaluation.trim()
        : '',

    expected_outcome:
      typeof idea.expected_outcome === 'string'
        ? idea.expected_outcome.trim()
        : '',
  };
}

// ============================================================
// PROJECT IDEAS CACHE
// ============================================================

function createProjectIdeasCacheKey(
  signature: string
): string {
  let hash = 2166136261;

  for (let i = 0; i < signature.length; i++) {
    hash ^= signature.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return `researchpilot:project-ideas:v1:${(
    hash >>> 0
  ).toString(16)}`;
}

// ============================================================
// SMALL CONTENT SECTION
// ============================================================

function ContentSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </h3>

      <p className="whitespace-pre-line text-[15px] leading-7 text-slate-700">
        {children}
      </p>
    </section>
  );
}

// ============================================================
// PAGE
// ============================================================

export default function ProjectIdeasPage() {
  const router = useRouter();

  const [papers, setPapers] = useState<ResearchPaper[]>([]);
  const [researchGaps, setResearchGaps] = useState<ResearchGap[]>([]);
  const [ideas, setIdeas] = useState<ProjectIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ==========================================================
  // OPEN THE SELECTED PROJECT'S DETAILS PAGE
  // ==========================================================

  function handleViewDetails(idea: ProjectIdea, index: number) {
    const ideaId =
      typeof idea.idea_id === 'string' && idea.idea_id.trim()
        ? idea.idea_id.trim()
        : `idea-${index + 1}`;

    const email =
      sessionStorage.getItem('researchGapEmail') ||
      localStorage.getItem('userEmail') ||
      '';

    const savedGoals =
      sessionStorage.getItem('researchGoals') ||
      sessionStorage.getItem('userGoals') ||
      sessionStorage.getItem('goals') ||
      localStorage.getItem('researchGoals') ||
      '';

    const savedSkills =
      sessionStorage.getItem('researchSkills') ||
      sessionStorage.getItem('userSkills') ||
      sessionStorage.getItem('skills') ||
      localStorage.getItem('researchSkills') ||
      localStorage.getItem('userSkills') ||
      '';

    const savedInterests =
      sessionStorage.getItem('researchInterests') ||
      sessionStorage.getItem('interests') ||
      localStorage.getItem('researchInterests') ||
      '';

    /*
     * Save the exact idea the user selected.
     * The details page reads this project rather than
     * generating the project idea again.
     */
    // Preserve all generated project ideas for the final dashboard.
    sessionStorage.setItem(
      'researchPilotDashboardIdeas',
      JSON.stringify(ideas)
    );

    sessionStorage.setItem(
      'researchPilotDashboardPapers',
      JSON.stringify(papers)
    );

    sessionStorage.setItem(
      'researchPilotDashboardGaps',
      JSON.stringify(researchGaps)
    );

    sessionStorage.setItem(
      'selectedProjectIdea',
      JSON.stringify({
        ...idea,
        idea_id: ideaId,
        email,
        papers,
        research_gaps:
          idea.research_gaps ?? researchGaps,
      })
    );

    /*
     * Save the context needed by the details page to request
     * the top three faculty recommendations.
     */
    const context = {
      email,
      papers,
      researchGaps,

      // Preserve the original stored gap data, including
      // fields not represented in the normalized state.
      researchGapData: sessionStorage.getItem('researchGaps'),

      // Include user context if an earlier page stored it.
      interests: savedInterests,
      goals: savedGoals,
      skills: savedSkills,

      selectedIdeaId: ideaId,
      selectedIdeaIndex: index,
    };

    sessionStorage.setItem(
      'selectedProjectContext',
      JSON.stringify(context)
    );

    // Navigate to:
    // app/problem-statement/[id]/page.tsx
    router.push(`/problem-statement/${encodeURIComponent(ideaId)}`);
  }

  // ==========================================================
  // LOAD DATA, RESTORE CACHE OR GENERATE PROJECT IDEAS
  // ==========================================================

  const generationStartedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate generation during React Strict Mode.
    if (generationStartedRef.current) {
      return;
    }

    generationStartedRef.current = true;

    let cancelled = false;

    const generateProjectIdeas = async () => {
      try {
        setLoading(true);
        setError(null);

        // ================================================
        // LOAD PAPERS
        // ================================================

        const storedPapers =
          sessionStorage.getItem('researchGapPapers');

        if (!storedPapers) {
          throw new Error(
            'No research papers were found. Please return to the recommendations page and start the process again.'
          );
        }

        let parsedPapers: unknown;

        try {
          parsedPapers = JSON.parse(storedPapers);
        } catch {
          throw new Error(
            'The selected research papers could not be loaded.'
          );
        }

        if (!Array.isArray(parsedPapers)) {
          throw new Error(
            'The selected research papers could not be loaded.'
          );
        }

        const selectedPapers = (
          parsedPapers as ResearchPaper[]
        )
          .filter(
            (paper) =>
              paper !== null &&
              typeof paper === 'object'
          )
          .map((paper) => normalizePaper(paper))
          .filter(
            (paper) =>
              typeof paper.title === 'string' &&
              paper.title.trim().length > 0 &&
              getPaperAbstract(paper).length > 0
          )
          .slice(0, 5);

        if (selectedPapers.length === 0) {
          throw new Error(
            'No research papers with usable abstracts were found. Please return to the research gap page and try again.'
          );
        }

        setPapers(selectedPapers);

        // ================================================
        // LOAD RESEARCH GAPS
        // ================================================

        const storedGaps =
          sessionStorage.getItem('researchGaps');

        if (!storedGaps || !storedGaps.trim()) {
          throw new Error(
            'No research gaps were found. Please return to the research gap page and complete the analysis first.'
          );
        }

        let parsedGaps: unknown;

        try {
          parsedGaps = JSON.parse(storedGaps);
        } catch {
          parsedGaps = storedGaps;
        }

        let normalizedGaps: ResearchGap[] = [];
        let researchGapsForRequest: unknown = parsedGaps;

        if (Array.isArray(parsedGaps)) {
          normalizedGaps = parsedGaps
            .filter(
              (gap): gap is ResearchGap =>
                gap !== null &&
                typeof gap === 'object'
            )
            .slice(0, 5);

          researchGapsForRequest = normalizedGaps;
        } else if (
          parsedGaps &&
          typeof parsedGaps === 'object'
        ) {
          const gapObject =
            parsedGaps as Record<string, unknown>;

          if (Array.isArray(gapObject.research_gaps)) {
            normalizedGaps =
              gapObject.research_gaps
                .filter(
                  (gap): gap is ResearchGap =>
                    gap !== null &&
                    typeof gap === 'object'
                )
                .slice(0, 5);

            researchGapsForRequest = normalizedGaps;
          } else if (Array.isArray(gapObject.gaps)) {
            normalizedGaps =
              gapObject.gaps
                .filter(
                  (gap): gap is ResearchGap =>
                    gap !== null &&
                    typeof gap === 'object'
                )
                .slice(0, 5);

            researchGapsForRequest = normalizedGaps;
          }
        }

        if (Array.isArray(researchGapsForRequest)) {
          if (researchGapsForRequest.length !== 5) {
            throw new Error(
              `Exactly five research gaps are required for project ideation. Found ${researchGapsForRequest.length}. Please return to the research gap page and generate the gaps again.`
            );
          }

          const validGaps =
            researchGapsForRequest.every(
              (gap) =>
                gap !== null &&
                typeof gap === 'object' &&
                typeof (gap as ResearchGap).description ===
                  'string' &&
                Boolean(
                  (gap as ResearchGap).description?.trim()
                )
            );

          if (!validGaps) {
            throw new Error(
              'The stored research gaps contain incomplete information. Please regenerate the research gaps.'
            );
          }
        } else if (
          typeof researchGapsForRequest === 'string'
        ) {
          if (!researchGapsForRequest.trim()) {
            throw new Error(
              'The stored research gaps are empty. Please return to the research gap page and complete the analysis again.'
            );
          }
        } else {
          throw new Error(
            'The stored research gaps have an unsupported format. Please regenerate the research gaps.'
          );
        }

        setResearchGaps(normalizedGaps);

        // ================================================
        // LOAD USER EMAIL
        // ================================================

        const email =
          sessionStorage.getItem('researchGapEmail') ||
          localStorage.getItem('userEmail') ||
          '';

        if (!email) {
          throw new Error(
            'User email is required. Please log in again.'
          );
        }

        // ================================================
        // BUILD REQUEST AND CACHE SIGNATURE
        // ================================================

        const requestBody = {
          email,
          papers: selectedPapers,
          research_gaps: researchGapsForRequest,
        };

        // Include all inputs that determine project ideation.
        // Different papers or gaps produce a different cache key.
        const cacheSignature = JSON.stringify({
          email: email.toLowerCase(),
          papers: selectedPapers.map((paper) => ({
            id: paper.id || '',
            title: paper.title || '',
            abstract: getPaperAbstract(paper),
          })),
          research_gaps: researchGapsForRequest,
        });

        const cacheKey =
          createProjectIdeasCacheKey(cacheSignature);

        console.log(
          'Project ideas cache key:',
          cacheKey
        );

        // ================================================
        // RESTORE CACHED PROJECT IDEAS
        // ================================================

        try {
          const saved = localStorage.getItem(cacheKey);

          if (saved) {
            const cached = JSON.parse(saved);

            // UPDATED: Accept any non-empty set of valid
            // cached ideas instead of requiring exactly five.
            const cacheIsValid =
              cached.signature === cacheSignature &&
              Array.isArray(cached.ideas) &&
              cached.ideas.length > 0 &&
              cached.ideas.every(
                (idea: ProjectIdea) =>
                  idea !== null &&
                  typeof idea === 'object' &&
                  typeof idea.title === 'string' &&
                  idea.title.trim().length > 0
              );

            if (cacheIsValid) {
              const cachedIdeas: ProjectIdea[] =
                cached.ideas;

              if (cancelled) return;

              setIdeas(cachedIdeas);

              // Maintain the existing workflow storage.
              sessionStorage.setItem(
                'projectIdeas',
                JSON.stringify(cachedIdeas)
              );

              sessionStorage.setItem(
                'researchGapPapers',
                JSON.stringify(selectedPapers)
              );

              sessionStorage.setItem(
                'researchGaps',
                JSON.stringify(researchGapsForRequest)
              );

              console.log(
                'Restored project ideas from localStorage. Backend generation skipped.'
              );

              setError(null);
              setLoading(false);
              return;
            }
          }
        } catch (cacheError) {
          console.warn(
            'Could not restore the project ideas cache:',
            cacheError
          );
        }

        // ================================================
        // CACHE MISS: CALL BACKEND
        // ================================================

        console.log(
          'No matching project ideas cache found. Generating new ideas.'
        );

        console.log(
          'Project ideation request:',
          requestBody
        );

        const response = await fetch(
          `${API_URL}/project-ideas`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );

        const responseText = await response.text();

        console.log(
          'Project ideas raw response:',
          responseText
        );

        let data: unknown;

        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(
            response.ok
              ? 'The project ideation service returned an invalid response.'
              : `Project ideation failed: ${
                  responseText ||
                  'The backend returned an empty response.'
                }`
          );
        }

        if (!response.ok) {
          let backendMessage =
            'Failed to create project ideas.';

          if (data && typeof data === 'object') {
            const errorData =
              data as Record<string, unknown>;

            if (typeof errorData.error === 'string') {
              backendMessage = errorData.error;
            } else if (
              typeof errorData.message === 'string'
            ) {
              backendMessage = errorData.message;
            }
          }

          throw new Error(backendMessage);
        }

        // ================================================
        // EXTRACT AND NORMALIZE IDEAS
        // ================================================

        const returnedIdeas = extractProjectIdeas(data);

        if (returnedIdeas.length === 0) {
          let responseDescription =
            'The backend response did not contain any project ideas.';

          if (data && typeof data === 'object') {
            const responseObject =
              data as Record<string, unknown>;

            if (typeof responseObject.error === 'string') {
              responseDescription = responseObject.error;
            } else if (
              typeof responseObject.message === 'string'
            ) {
              responseDescription = responseObject.message;
            }
          }

          throw new Error(responseDescription);
        }

        const normalizedIdeas = returnedIdeas
          .slice(0, 5)
          .map((idea, index) =>
            normalizeProjectIdea(idea, index)
          )
          .filter(
            (idea) =>
              typeof idea.title === 'string' &&
              idea.title.trim().length > 0
          );

        // UPDATED: Only show an error if no valid ideas remain.
        // One to four valid ideas are displayed normally.
        if (normalizedIdeas.length === 0) {
          throw new Error(
            'No valid project ideas were returned. Please try generating the project ideas again.'
          );
        }

        if (cancelled) return;

        // ================================================
        // SAVE GENERATED IDEAS
        // ================================================

        setIdeas(normalizedIdeas);

        // Keep sessionStorage for the current workflow
        // and for the Problem Statement Details page.
        sessionStorage.setItem(
          'projectIdeas',
          JSON.stringify(normalizedIdeas)
        );

        sessionStorage.setItem(
          'researchGapPapers',
          JSON.stringify(selectedPapers)
        );

        sessionStorage.setItem(
          'researchGaps',
          JSON.stringify(researchGapsForRequest)
        );

        // Persist the result across page refreshes.
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              signature: cacheSignature,
              ideas: normalizedIdeas,
              savedAt: new Date().toISOString(),
            })
          );

          console.log(
            'Project ideas saved to localStorage.'
          );
        } catch (storageError) {
          console.warn(
            'Could not save the project ideas cache:',
            storageError
          );
        }
      } catch (err) {
        if (cancelled) return;

        console.error(
          'Project idea generation error:',
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to create project ideas.'
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    generateProjectIdeas();

    return () => {
      cancelled = true;
    };

    // Inputs are intentionally read from sessionStorage on
    // initial page load; this page does not regenerate merely
    // because React re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900">
      {/* TOP NAVIGATION */}

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/research-gaps"
            className="group flex items-center gap-2.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white transition-colors group-hover:border-slate-300 group-hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />
            </span>

            <span className="hidden sm:inline">Research Gaps</span>
          </Link>

          <Link
            href="/"
            className="absolute left-1/2 -translate-x-1/2 text-[15px] font-bold tracking-[0.18em] text-slate-900"
          >
            RESEARCHPILOT
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/account_view?returnTo=/project-ideas"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <UserRound className="h-3.5 w-3.5" />
              <span>Profile</span>
            </Link>

            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Project Ideation
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}

      <div className="mx-auto w-full max-w-7xl px-5 pb-20 pt-8 sm:px-8">
        {/* WORKFLOW */}

        <div className="mb-10 flex items-center justify-center">
          <div className="flex w-full max-w-5xl items-center justify-between gap-1 sm:gap-2">
            {/* STEP 1: RESEARCH PROFILE */}

            <div className="flex min-w-0 flex-col items-center gap-1.5 text-center text-xs font-medium text-slate-400 sm:flex-row sm:gap-2">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                1
              </span>
              <span className="text-[10px] sm:text-xs">Research Profile</span>
            </div>

            <div className="h-px min-w-2 flex-1 bg-slate-200" />

            {/* STEP 2: PAPER RECOMMENDATIONS */}

            <div className="flex min-w-0 flex-col items-center gap-1.5 text-center text-xs font-medium text-slate-400 sm:flex-row sm:gap-2">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                2
              </span>
              <span className="text-[10px] sm:text-xs">Paper Recommendations</span>
            </div>

            <div className="h-px min-w-2 flex-1 bg-slate-200" />

            {/* STEP 3: RESEARCH GAPS */}

            <div className="flex min-w-0 flex-col items-center gap-1.5 text-center text-xs font-medium text-slate-400 sm:flex-row sm:gap-2">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                3
              </span>
              <span className="text-[10px] sm:text-xs">Research Gaps</span>
            </div>

            <div className="h-px min-w-2 flex-1 bg-slate-200" />

            {/* STEP 4: PROJECT IDEAS — ACTIVE */}

            <div className="flex min-w-0 flex-col items-center gap-1.5 text-center text-xs font-semibold text-slate-900 sm:flex-row sm:gap-2">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                4
              </span>
              <span className="text-[10px] sm:text-xs">Project Ideas</span>
            </div>

            <div className="h-px min-w-2 flex-1 bg-slate-200" />

            {/* STEP 5: FACULTY ASSIGNMENT */}

            <div className="flex min-w-0 flex-col items-center gap-1.5 text-center text-xs font-medium text-slate-400 sm:flex-row sm:gap-2">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                5
              </span>
              <span className="text-[10px] sm:text-xs">Faculty Assignment</span>
            </div>

            <div className="h-px min-w-2 flex-1 bg-slate-200" />

            {/* STEP 6: FINAL DASHBOARD */}

            <div className="flex min-w-0 flex-col items-center gap-1.5 text-center text-xs font-medium text-slate-400 sm:flex-row sm:gap-2">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                6
              </span>
              <span className="text-[10px] sm:text-xs">Final Dashboard</span>
            </div>
          </div>
        </div>

        {/* PAGE INTRO */}

        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
            ) : error ? (
              <AlertCircle className="h-5 w-5 text-red-600" />
            ) : (
              <Lightbulb className="h-5 w-5 text-slate-800" />
            )}
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            From Research Gaps to Action
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Project Ideas
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-slate-600">
            Transform the identified research gaps into concrete,
            feasible project directions that can be explored further.
          </p>
        </div>

        {/* LOADING */}

        {loading && (
          <div className="mx-auto max-w-3xl">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-1 w-full bg-slate-100">
                <div className="h-full w-2/5 animate-pulse bg-slate-800" />
              </div>

              <div className="px-6 py-14 text-center sm:px-10">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                  <Lightbulb className="h-7 w-7 animate-pulse text-slate-700" />
                </div>

                <h2 className="text-xl font-semibold text-slate-950">
                  Developing project directions
                </h2>

                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  The selected literature and five identified research
                  gaps are being used to develop distinct project ideas.
                </p>

                <div className="mt-7 flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analysis in progress
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ERROR */}

        {!loading && error && (
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-red-200 bg-white shadow-sm">
              <div className="border-b border-red-100 bg-red-50/60 px-6 py-5 sm:px-7">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-100">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>

                  <div>
                    <h2 className="font-semibold text-red-950">
                      Could not create project ideas
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-red-800/80">
                      {error}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 sm:px-7">
                <Link
                  href="/research-gaps"
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Return to Research Gaps
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* RESULTS */}

        {!loading && !error && ideas.length > 0 && (
          <div className="space-y-8">
            {/* SUMMARY */}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                    <Lightbulb className="h-5 w-5 text-slate-700" />
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Project Directions
                    </p>
                    <p className="mt-0.5 text-xl font-bold text-slate-950">
                      {ideas.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                    <CircleDot className="h-5 w-5 text-slate-700" />
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Research Gaps
                    </p>
                    <p className="mt-0.5 text-xl font-bold text-slate-950">
                      {researchGaps.length || 5}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                    <FileText className="h-5 w-5 text-slate-700" />
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Source Papers
                    </p>
                    <p className="mt-0.5 text-xl font-bold text-slate-950">
                      {papers.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* RESULT INTRO */}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Generated Directions
                </p>

                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                  Explore the possibilities
                </h2>
              </div>

              <p className="max-w-md text-sm leading-6 text-slate-500 sm:text-right">
                Each direction connects a research gap with a potential
                problem, approach, technology stack and evaluation strategy.
              </p>
            </div>

            {/* PROJECT IDEAS */}

            <div className="space-y-6">
              {ideas.map((idea, index) => (
                <article
                  key={idea.idea_id || `idea-${index}`}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* IDEA HEADER */}

                  <div className="border-b border-slate-100 px-6 py-6 sm:px-8">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                        {String(index + 1).padStart(2, '0')}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.13em] text-slate-400">
                          Project Direction {index + 1}
                        </p>

                        <h3 className="text-xl font-bold leading-snug tracking-tight text-slate-950 sm:text-2xl">
                          {idea.title || `Project Idea ${index + 1}`}
                        </h3>

                        {idea.difficulty && (
                          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              Difficulty
                            </span>

                            <span className="text-xs font-semibold text-slate-700">
                              {idea.difficulty}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* IDEA BODY */}

                  <div className="px-6 py-7 sm:px-8">
                    <div className="grid gap-8 lg:grid-cols-2">
                      {/* LEFT COLUMN */}

                      <div className="space-y-7">
                        {idea.problem_statement && (
                          <ContentSection label="Problem Statement">
                            {idea.problem_statement}
                          </ContentSection>
                        )}

                        {idea.research_gap && (
                          <ContentSection label="Research Gap Addressed">
                            {idea.research_gap}
                          </ContentSection>
                        )}

                        {idea.gap_category && (
                          <div>
                            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                              Gap Category
                            </h3>

                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                              {idea.gap_category}
                            </span>
                          </div>
                        )}

                        {idea.relevance && (
                          <ContentSection label="Relevance">
                            {idea.relevance}
                          </ContentSection>
                        )}
                      </div>

                      {/* RIGHT COLUMN */}

                      <div className="space-y-7">
                        {idea.proposed_approach && (
                          <div>
                            <div className="mb-2 flex items-center gap-2">
                              <Wrench className="h-3.5 w-3.5 text-slate-500" />

                              <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                                Proposed Approach
                              </h3>
                            </div>

                            <p className="whitespace-pre-line text-[15px] leading-7 text-slate-700">
                              {idea.proposed_approach}
                            </p>
                          </div>
                        )}

                        {Array.isArray(idea.recommended_technologies) &&
                          idea.recommended_technologies.length > 0 && (
                            <div>
                              <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                                Recommended Technologies
                              </h3>

                              <div className="flex flex-wrap gap-2">
                                {idea.recommended_technologies.map(
                                  (technology, technologyIndex) => (
                                    <span
                                      key={technologyIndex}
                                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                                    >
                                      {technology}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                        {idea.evaluation && (
                          <ContentSection label="Evaluation">
                            {idea.evaluation}
                          </ContentSection>
                        )}

                        {idea.expected_outcome && (
                          <ContentSection label="Expected Outcome">
                            {idea.expected_outcome}
                          </ContentSection>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* IDEA FOOTER */}

                  <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-5 sm:px-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                        <Target className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />

                        <span>
                          This direction is derived from the research
                          context identified earlier in the workflow.
                        </span>
                      </div>

                      {/* OPEN FULL PROJECT DETAILS */}

                      <button
                        type="button"
                        onClick={() => handleViewDetails(idea, index)}
                        className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                      >
                        View Full Details &amp; Faculty
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* RESEARCH CONTEXT */}

            {papers.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-6 py-6 sm:px-8">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100">
                      <FileText className="h-5 w-5 text-slate-700" />
                    </div>

                    <div>
                      <h2 className="font-semibold text-slate-950">
                        Research Context
                      </h2>

                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        The same {papers.length} research paper
                        {papers.length === 1 ? '' : 's'} used during
                        research-gap identification informed these project
                        directions.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {papers.map((paper, index) => (
                    <div
                      key={paper.id || `source-${index}`}
                      className="flex items-start gap-4 px-6 py-4 sm:px-8"
                    >
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                        {index + 1}
                      </span>

                      <p className="pt-0.5 text-sm leading-6 text-slate-700">
                        {paper.title || 'Research Paper'}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* COMPLETION CARD */}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm">
              <div className="flex flex-col gap-5 px-6 py-7 sm:px-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Research Discovery Complete
                    </p>

                    <h2 className="mt-1 text-lg font-semibold text-white">
                      Your project directions are ready
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                      Review the generated directions alongside their
                      research gaps, proposed approaches, technologies and
                      evaluation strategies. Select “View Full Details &
                      Faculty” on any idea to explore its full details and
                      faculty matches.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/research-gaps"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Review Research Gaps
                  </Link>

                  <Link
                    href="/recommendations"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Back to Research Discovery
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>

            {/* DISCLAIMER */}

            <p className="mx-auto max-w-3xl text-center text-xs leading-6 text-slate-400">
              These project directions are suggestions for further
              development. Feasibility, originality, available datasets,
              technical requirements, and relevant literature should be
              reviewed before implementation.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}