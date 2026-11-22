
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
  RefreshCw,
  Target,
  Users,
  Wrench,
  BookOpen,
  Award,
  LayoutDashboard,
} from 'lucide-react';

const API_URL = 'http://127.0.0.1:5000';

type ResearchPaper = {
  id?: string;
  title?: string;
  summary?: string;
  abstract?: string;
  url?: string;
  date?: string;
  authors?: { name: string; id: string }[];
  [key: string]: unknown;
};

type ResearchGap = {
  gap_id?: string;
  description?: string;
  evidence?: string;
  research_opportunity?: string;
  category?: string;
  [key: string]: unknown;
};

type ProjectIdea = {
  idea_id?: string;
  project_number?: number;
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
  papers?: ResearchPaper[];
  research_gaps?: unknown;
  [key: string]: unknown;
};

type FacultyMember = {
  id?: string;
  faculty_id?: string;
  name?: string;
  faculty_name?: string;
  full_name?: string;
  department?: string;
  designation?: string;
  email?: string;
  profile_url?: string;
  photo_url?: string;
  image_url?: string;
  profile_image?: string;
  photo?: string;
  score?: number | string;
  match_score?: number | string;
  relevance_score?: number | string;
  research_areas?: string[] | string;
  expertise?: string[] | string;
  areas_of_expertise?: string[] | string;
  publications?: unknown[];
  papers?: unknown[];
  match_reason?: string;
  explanation?: string;
  reason?: string;
  [key: string]: unknown;
};

type StoredContext = {
  email?: string;
  papers?: ResearchPaper[];
  research_gaps?: unknown;
  goals?: unknown;
  skills?: unknown;
  interests?: unknown;
  [key: string]: unknown;
};

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim();

  if (typeof value === 'number') return String(value);

  if (Array.isArray(value)) {
    return value.map(asText).filter(Boolean).join(', ');
  }

  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;

    for (const key of ['description', 'text', 'name', 'title', 'value']) {
      if (object[key] !== undefined) {
        const text = asText(object[key]);
        if (text) return text;
      }
    }

    return '';
  }

  return '';
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(asText).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getFacultyName(faculty: FacultyMember): string {
  return (
    asText(faculty.name) ||
    asText(faculty.faculty_name) ||
    asText(faculty.full_name) ||
    'Faculty member'
  );
}

/**
 * Extract the PES faculty ID.
 *
 * Checks:
 * 1. faculty_id
 * 2. id
 * 3. Faculty ID embedded in profile_url
 */
function getFacultyId(faculty: FacultyMember): string {
  const directId =
    asText(faculty.faculty_id) ||
    asText(faculty.id);

  if (/^nm\d+$/i.test(directId)) {
    return directId.toLowerCase();
  }

  const profileUrl = asText(faculty.profile_url);

  if (profileUrl) {
    const match = profileUrl.match(/\/(nm\d+)\/?/i);

    if (match) {
      return match[1].toLowerCase();
    }
  }

  return '';
}

/**
 * Resolve the faculty photograph URL.
 *
 * The Flask endpoint is preferred because it serves the locally
 * downloaded photographs from data_processing/faculty_photos.
 */
function getFacultyPhoto(faculty: FacultyMember): string {
  const facultyId = getFacultyId(faculty);

  if (facultyId) {
    return `${API_URL}/faculty-photos/${facultyId}`;
  }

  // Fallback to an image URL returned by the backend.
  return (
    asText(faculty.photo_url) ||
    asText(faculty.image_url) ||
    asText(faculty.profile_image) ||
    asText(faculty.photo)
  );
}

function getFacultyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) return 'F';

  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Rectangular faculty photograph.
 *
 * Displays initials only if the image is unavailable or fails to load.
 */
function FacultyPhoto({
  photoUrl,
  name,
}: {
  photoUrl: string;
  name: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  // Reset the fallback if a different photograph URL is supplied.
  useEffect(() => {
    setImageFailed(false);
  }, [photoUrl]);

  if (!photoUrl || imageFailed) {
    return (
      <div
        className="flex h-24 w-[76px] flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-base font-semibold text-slate-600"
        aria-label={`${name} profile photo unavailable`}
      >
        {getFacultyInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={photoUrl}
      alt={`${name} profile`}
      className="h-24 w-[76px] flex-shrink-0 rounded-lg border border-slate-200 bg-slate-100 object-cover object-center shadow-sm"
      loading="eager"
      onError={() => {
        console.error(
          `Could not load faculty photograph for ${name}:`,
          photoUrl,
        );
        setImageFailed(true);
      }}
    />
  );
}

function getFacultyScore(faculty: FacultyMember): number | null {
  const raw =
    faculty.match_score ?? faculty.relevance_score ?? faculty.score;

  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;

  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw.replace('%', '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractFaculty(data: unknown): FacultyMember[] {
  if (Array.isArray(data)) return data as FacultyMember[];

  if (!data || typeof data !== 'object') return [];

  const object = data as Record<string, unknown>;

  for (const key of [
    'faculty_recommendations',
    'faculty',
    'recommendations',
    'ranked_faculty',
    'results',
    'items',
  ]) {
    if (Array.isArray(object[key])) {
      return object[key] as FacultyMember[];
    }
  }

  for (const key of ['data', 'result', 'response', 'output']) {
    const nested = object[key];

    if (Array.isArray(nested)) return nested as FacultyMember[];

    if (nested && typeof nested === 'object') {
      const faculty = extractFaculty(nested);
      if (faculty.length) return faculty;
    }
  }

  return [];
}

function responseError(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const object = data as Record<string, unknown>;

    if (typeof object.error === 'string') return object.error;
    if (typeof object.message === 'string') return object.message;
  }

  return fallback;
}

function createFacultyCacheKey(signature: string): string {
  let hash = 2166136261;

  for (let i = 0; i < signature.length; i++) {
    hash ^= signature.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return `researchpilot:faculty:v1:${(hash >>> 0).toString(16)}`;
}

function DetailSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!children) return null;

  return (
    <section className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        {icon && <span className="text-slate-500">{icon}</span>}
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      </div>

      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
        {children}
      </div>
    </section>
  );
}

function FacultyList({ value }: { value: unknown }) {
  const items = asList(value);

  if (!items.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export default function ProjectDetailsPage() {
  const params = useParams<{ id: string }>();
  const routeId = String(params.id ?? '');

  const [idea, setIdea] = useState<ProjectIdea | null>(null);
  const [context, setContext] = useState<StoredContext>({});
  const [faculty, setFaculty] = useState<FacultyMember[]>([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingFaculty, setLoadingFaculty] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [facultyError, setFacultyError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored =
        sessionStorage.getItem('selectedProjectIdea') ??
        sessionStorage.getItem('researchPilotSelectedProject');

      if (!stored) {
        setProjectError(
          'The selected project could not be found. Return to Project Ideas and open a project again.',
        );
        return;
      }

      const parsed = JSON.parse(stored) as ProjectIdea;

      if (
        parsed.idea_id &&
        routeId &&
        parsed.idea_id !== routeId
      ) {
        setProjectError(
          'The stored project does not match this page. Return to Project Ideas and select the project again.',
        );
        return;
      }

      setIdea(parsed);

      const storedContext =
        sessionStorage.getItem('selectedProjectContext') ??
        sessionStorage.getItem('researchPilotProjectContext');

      if (storedContext) {
        setContext(JSON.parse(storedContext) as StoredContext);
      } else {
        setContext({
          email: parsed.email,
          papers: parsed.papers,
          research_gaps: parsed.research_gaps,
        });
      }
    } catch (error) {
      console.error('Could not load selected project:', error);

      setProjectError(
        'The selected project details could not be read. Return to Project Ideas and select it again.',
      );
    } finally {
      setLoadingProject(false);
    }
  }, [routeId]);

  const activeFacultyRequestRef = useRef<string | null>(null);

  const loadFaculty = useCallback(async (forceRefresh = false) => {
    if (!idea) return;

    setLoadingFaculty(true);
    setFacultyError(null);

    try {
      const email =
        asText(idea.email) ||
        asText(context.email) ||
        sessionStorage.getItem('researchGapEmail') ||
        localStorage.getItem('userEmail') ||
        '';

      const savedGoals =
        sessionStorage.getItem('researchGoals') ||
        sessionStorage.getItem('userGoals') ||
        localStorage.getItem('researchGoals') ||
        '';

      const savedSkills =
        sessionStorage.getItem('researchSkills') ||
        sessionStorage.getItem('userSkills') ||
        localStorage.getItem('researchSkills') ||
        '';

      const savedInterests =
        asText(context.interests) ||
        sessionStorage.getItem('researchInterests') ||
        sessionStorage.getItem('interests') ||
        localStorage.getItem('researchInterests') ||
        '';

      const papers = Array.isArray(idea.papers)
        ? idea.papers
        : Array.isArray(context.papers)
          ? context.papers
          : [];

      const gaps =
        idea.research_gaps ??
        context.research_gaps ??
        sessionStorage.getItem('researchGaps') ??
        [];

      const payload = {
        email,
        idea_id: idea.idea_id,
        project_title: idea.title || '',
        problem_statement: idea.problem_statement || '',
        project_idea: idea,
        research_gap: idea.research_gap || '',
        gap_category: idea.gap_category || '',
        proposed_approach: idea.proposed_approach || '',
        recommended_technologies: idea.recommended_technologies || [],
        relevance: idea.relevance || '',
        difficulty: idea.difficulty || '',
        evaluation: idea.evaluation || '',
        expected_outcome: idea.expected_outcome || '',
        research_gaps: gaps,
        papers,
        goals: context.goals ?? savedGoals,
        skills: context.skills ?? savedSkills,
        interests: savedInterests,
        project_context: {
          title: idea.title || '',
          problem_statement: idea.problem_statement || '',
          research_gap: idea.research_gap || '',
          gap_category: idea.gap_category || '',
          proposed_approach: idea.proposed_approach || '',
          recommended_technologies: idea.recommended_technologies || [],
          relevance: idea.relevance || '',
          evaluation: idea.evaluation || '',
          expected_outcome: idea.expected_outcome || '',
          goals: context.goals ?? savedGoals,
          skills: context.skills ?? savedSkills,
          interests: savedInterests,
          papers,
          research_gaps: gaps,
        },
      };

      // Include the route ID as well as the complete recommendation input.
      const signature = JSON.stringify({
        routeId,
        payload,
      });

      const cacheKey = createFacultyCacheKey(signature);

      // Avoid duplicate simultaneous requests for the same project/input.
      if (activeFacultyRequestRef.current === cacheKey) {
        return;
      }

      // Restore successful results from this browser tab's session.
      if (!forceRefresh) {
        try {
          const cached = sessionStorage.getItem(cacheKey);

          if (cached) {
            const record = JSON.parse(cached) as {
              signature?: string;
              faculty?: FacultyMember[];
            };

            if (
              record.signature === signature &&
              Array.isArray(record.faculty) &&
              record.faculty.length > 0
            ) {
              const cachedFaculty = record.faculty.slice(0, 3);

              setFaculty(cachedFaculty);
              setFacultyError(null);

              try {
                sessionStorage.setItem(
                  'researchPilotDashboardProject',
                  JSON.stringify(idea),
                );

                sessionStorage.setItem(
                  'researchPilotDashboardContext',
                  JSON.stringify(context),
                );

                sessionStorage.setItem(
                  'researchPilotDashboardFaculty',
                  JSON.stringify(cachedFaculty),
                );
              } catch (storageError) {
                console.warn(
                  'Could not save cached dashboard data:',
                  storageError,
                );
              }

              setLoadingFaculty(false);
              return;
            }
          }
        } catch (cacheError) {
          console.warn(
            'Could not read cached faculty recommendations:',
            cacheError,
          );
        }
      }

      activeFacultyRequestRef.current = cacheKey;
      setFaculty([]);

      const response = await fetch(
        `${API_URL}/faculty-recommendations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      const responseText = await response.text();
      let data: unknown;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          response.ok
            ? 'The faculty service returned an invalid response.'
            : responseText || 'The faculty recommendation request failed.',
        );
      }

      if (!response.ok) {
        throw new Error(
          responseError(data, 'Could not load faculty recommendations.'),
        );
      }

      const ranked = extractFaculty(data).slice(0, 3);

      if (!ranked.length) {
        throw new Error(
          'The faculty service did not return any faculty recommendations.',
        );
      }

      setFaculty(ranked);

      // Save the final project and faculty results for the dashboard.
      try {
        sessionStorage.setItem(
          'researchPilotDashboardProject',
          JSON.stringify(idea),
        );

        sessionStorage.setItem(
          'researchPilotDashboardContext',
          JSON.stringify(context),
        );

        sessionStorage.setItem(
          'researchPilotDashboardFaculty',
          JSON.stringify(ranked),
        );
      } catch (storageError) {
        console.warn(
          'Could not save dashboard data:',
          storageError,
        );
      }

      // Cache only successful, non-empty faculty results.
      try {
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({
            signature,
            faculty: ranked,
            savedAt: Date.now(),
          }),
        );
      } catch (cacheError) {
        console.warn(
          'Could not save faculty recommendations to session storage:',
          cacheError,
        );
      }
    } catch (error) {
      console.error('Faculty recommendation error:', error);

      setFacultyError(
        error instanceof Error
          ? error.message
          : 'Could not load faculty recommendations.',
      );
    } finally {
      if (activeFacultyRequestRef.current) {
        activeFacultyRequestRef.current = null;
      }

      setLoadingFaculty(false);
    }
  }, [idea, context, routeId]);

  useEffect(() => {
    if (idea) loadFaculty();
  }, [idea, loadFaculty]);

  const papers = Array.isArray(idea?.papers)
    ? idea.papers
    : Array.isArray(context.papers)
      ? context.papers
      : [];

  const technologies = asList(idea?.recommended_technologies);

  const knownKeys = new Set([
    'idea_id',
    'project_number',
    'title',
    'problem_statement',
    'research_gap',
    'gap_category',
    'proposed_approach',
    'recommended_technologies',
    'relevance',
    'difficulty',
    'evaluation',
    'expected_outcome',
    'email',
    'papers',
    'research_gaps',
  ]);

  const extraFields = idea
    ? Object.entries(idea).filter(
        ([key, value]) =>
          !knownKeys.has(key) &&
          value !== null &&
          value !== undefined &&
          value !== '',
      )
    : [];

  if (loadingProject) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f9fc] px-5">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-700" />

          <p className="mt-4 text-sm text-slate-600">
            Loading selected project…
          </p>
        </div>
      </main>
    );
  }

  if (projectError || !idea) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] px-5 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-white p-7 shadow-sm">
          <AlertCircle className="h-7 w-7 text-red-600" />

          <h1 className="mt-4 text-xl font-bold">Project unavailable</h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {projectError || 'The selected project could not be loaded.'}
          </p>

          <Link
            href="/project-ideas"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Project Ideas
          </Link>
        </div>
      </main>
    );
  }

  const workflowSteps = [
    { number: 1, label: 'Research Profile' },
    { number: 2, label: 'Paper Recommendations' },
    { number: 3, label: 'Research Gaps' },
    { number: 4, label: 'Project Ideas' },
    { number: 5, label: 'Faculty Assignment' },
    { number: 6, label: 'Final Dashboard' },
  ];

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/project-ideas"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white">
              <ArrowLeft className="h-4 w-4" />
            </span>

            <span className="hidden sm:inline">Project Ideas</span>
          </Link>

          <Link
            href="/"
            className="absolute left-1/2 -translate-x-1/2 text-[15px] font-bold tracking-[0.18em]"
          >
            RESEARCHPILOT
          </Link>

          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
            Project Details
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pb-20 pt-8 sm:px-8">
        <div className="mb-6">
          <Link
            href="/project-ideas"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            All Project Ideas
          </Link>
        </div>

        {/* SIX-STEP WORKFLOW */}
        <nav
          aria-label="Research workflow progress"
          className="mx-auto mb-10 w-full max-w-5xl"
        >
          <div className="flex flex-wrap items-start justify-center gap-x-3 gap-y-5 sm:gap-x-4">
            {workflowSteps.map((step, index) => {
              const isActive = step.number === 5;

              return (
                <div
                  key={step.number}
                  className="flex min-w-[88px] flex-1 items-start justify-center sm:min-w-[110px]"
                >
                  <div className="flex w-full flex-col items-center text-center">
                    <div className="flex w-full items-center justify-center">
                      {index > 0 && (
                        <div className="h-px flex-1 bg-slate-300" />
                      )}

                      <div
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                          isActive
                            ? 'border-slate-950 bg-slate-950 text-white'
                            : 'border-slate-300 bg-white text-slate-500'
                        }`}
                      >
                        {step.number}
                      </div>

                      {index < workflowSteps.length - 1 && (
                        <div className="h-px flex-1 bg-slate-300" />
                      )}
                    </div>

                    <span
                      className={`mt-2 max-w-[125px] text-xs leading-5 sm:text-sm ${
                        isActive
                          ? 'font-semibold text-slate-950'
                          : 'font-medium text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-7 sm:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                Project {idea.project_number || ''}
              </span>

              {idea.gap_category && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                  {idea.gap_category}
                </span>
              )}

              {idea.difficulty && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                  Difficulty: {idea.difficulty}
                </span>
              )}
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              {idea.title || 'Project Details'}
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Complete project brief and faculty expertise alignment for this
              selected research direction.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/final-dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <LayoutDashboard className="h-4 w-4" />
                View Final Dashboard
              </Link>
            </div>
          </div>

          <div className="grid gap-4 bg-slate-50/70 p-6 sm:grid-cols-3 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                <Target className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs text-slate-500">Research Gap</p>
                <p className="text-sm font-semibold">
                  {idea.research_gap ? 'Identified' : 'Not provided'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                <FileText className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs text-slate-500">Source Papers</p>
                <p className="text-sm font-semibold">{papers.length}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                <Users className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs text-slate-500">Faculty Matches</p>
                <p className="text-sm font-semibold">
                  {faculty.length ? `${faculty.length} ranked` : 'Pending'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PROJECT DETAILS */}
        <div className="space-y-8">
          <section className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Project Specification
              </p>

              <h2 className="mt-1 text-xl font-bold">
                Complete project brief
              </h2>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
              <DetailSection
                title="Problem Statement"
                icon={<Target className="h-4 w-4" />}
              >
                {asText(idea.problem_statement) ||
                  'No problem statement was provided for this idea.'}
              </DetailSection>

              <DetailSection
                title="Research Gap Addressed"
                icon={<BookOpen className="h-4 w-4" />}
              >
                {asText(idea.research_gap) ||
                  'No research gap description was provided.'}
              </DetailSection>

              <DetailSection
                title="Proposed Approach"
                icon={<Wrench className="h-4 w-4" />}
              >
                {asText(idea.proposed_approach) ||
                  'No proposed approach was provided.'}
              </DetailSection>

              <DetailSection title="Relevance">
                {asText(idea.relevance)}
              </DetailSection>

              <DetailSection title="Recommended Technologies">
                {technologies.length ? (
                  <div className="flex flex-wrap gap-2">
                    {technologies.map((technology, index) => (
                      <span
                        key={`${technology}-${index}`}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                      >
                        {technology}
                      </span>
                    ))}
                  </div>
                ) : null}
              </DetailSection>

              <DetailSection title="Evaluation Strategy">
                {asText(idea.evaluation)}
              </DetailSection>

              <DetailSection title="Expected Outcome">
                {asText(idea.expected_outcome)}
              </DetailSection>
            </div>

            {extraFields.length > 0 && (
              <DetailSection title="Additional Project Information">
                <div className="space-y-4">
                  {extraFields.map(([key, value]) => (
                    <div key={key}>
                      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {key.replace(/_/g, ' ')}
                      </h3>

                      <p className="break-words">
                        {typeof value === 'string' ||
                        typeof value === 'number'
                          ? String(value)
                          : JSON.stringify(value, null, 2)}
                      </p>
                    </div>
                  ))}
                </div>
              </DetailSection>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-bold">Source Research Papers</h2>
              </div>

              {papers.length ? (
                <div className="divide-y divide-slate-100">
                  {papers.map((paper, index) => (
                    <div
                      key={paper.id || `paper-${index}`}
                      className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
                    >
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                        {index + 1}
                      </span>

                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-6 text-slate-800">
                          {asText(paper.title) || 'Research Paper'}
                        </p>

                        {paper.url && (
                          <a
                            href={paper.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
                          >
                            View paper
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No source papers were attached to this project.
                </p>
              )}
            </section>
          </section>

          {/* FACULTY ALIGNMENT */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <GraduationCap className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Expertise Alignment
                    </p>

                    <h2 className="mt-1 text-lg font-bold">
                      Top 3 Faculty Matches
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Ranked for relevance to this specific project.
                    </p>
                  </div>
                </div>

                {!loadingFaculty && !facultyError && faculty.length > 0 && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                    {faculty.length} faculty matched
                  </span>
                )}
              </div>
            </div>

            {loadingFaculty && (
              <div className="px-6 py-12 text-center">
                <Loader2 className="mx-auto h-7 w-7 animate-spin text-slate-700" />

                <p className="mt-4 text-sm font-medium text-slate-800">
                  Matching faculty expertise
                </p>

                <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-slate-500">
                  Analysing the problem statement, research gap, project
                  approach, source papers, and available goals and skills.
                </p>
              </div>
            )}

            {!loadingFaculty && facultyError && (
              <div className="p-5 sm:p-6">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />

                    <div>
                      <p className="text-sm font-semibold text-amber-950">
                        Faculty matches unavailable
                      </p>

                      <p className="mt-1 text-xs leading-5 text-amber-900">
                        {facultyError}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => loadFaculty(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try again
                  </button>
                </div>

                <p className="mt-4 text-xs leading-5 text-slate-500">
                  Check that the Flask backend is running and that
                  <code className="mx-1 rounded bg-slate-100 px-1 py-0.5">
                    POST /faculty-recommendations
                  </code>
                  is implemented.
                </p>
              </div>
            )}

            {!loadingFaculty && !facultyError && faculty.length > 0 && (
              <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
                {faculty.map((member, index) => {
                  const name = getFacultyName(member);
                  const photoUrl = getFacultyPhoto(member);
                  const score = getFacultyScore(member);

                  const areas =
                    member.research_areas ??
                    member.areas_of_expertise ??
                    member.expertise;

                  const publications =
                    member.publications ?? member.papers;

                  const explanation =
                    asText(member.match_reason) ||
                    asText(member.explanation) ||
                    asText(member.reason);

                  return (
                    <article
                      key={
                        member.faculty_id ||
                        member.id ||
                        `${name}-${index}`
                      }
                      className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm sm:p-5"
                    >
                      <div className="flex items-center gap-3">
                        {/* Faculty ranking */}
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800">
                          #{index + 1}
                        </div>

                        {/* Rectangular faculty photograph */}
                        <FacultyPhoto
                          photoUrl={photoUrl}
                          name={name}
                        />

                        {/* Faculty name and department */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3 className="break-words font-semibold leading-6 text-slate-950">
                              {name}
                            </h3>

                            {score !== null && (
                              <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                                <Award className="h-3 w-3" />
                                {score}
                                {score >= 0 && score <= 1
                                  ? ' score'
                                  : '%'}
                              </span>
                            )}
                          </div>

                          {(member.designation || member.department) && (
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {[member.designation, member.department]
                                .map(asText)
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>

                      {explanation && (
                        <div className="mt-4 rounded-xl bg-slate-50 p-3">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                            Why this faculty member matches
                          </p>

                          <p className="text-xs leading-6 text-slate-700">
                            {explanation}
                          </p>
                        </div>
                      )}

                      {asList(areas).length > 0 && (
                        <div className="mt-4">
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                            Research Areas &amp; Expertise
                          </p>

                          <FacultyList value={areas} />
                        </div>
                      )}

                      {Array.isArray(publications) &&
                        publications.length > 0 && (
                          <div className="mt-4">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                              Relevant Publications
                            </p>

                            <ul className="space-y-2">
                              {publications.slice(0, 3).map((paper, i) => {
                                const title = asText(paper);

                                return (
                                  <li
                                    key={`${title}-${i}`}
                                    className="flex items-start gap-2 text-xs leading-5 text-slate-600"
                                  >
                                    <FileText className="mt-1 h-3 w-3 flex-shrink-0" />

                                    <span>
                                      {title ||
                                        'Publication details available in faculty records'}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}

                      <div className="mt-auto flex flex-wrap gap-3 pt-4">
                        {member.email && (
                          <a
                            href={`mailto:${member.email}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950"
                          >
                            Contact faculty
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}

                        {member.profile_url && (
                          <a
                            href={member.profile_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950"
                          >
                            View profile
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {!loadingFaculty && !facultyError && faculty.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
                <p className="text-xs leading-5 text-slate-500">
                  Rankings are based on the faculty data and matching results
                  returned by the backend. Review research areas and
                  publications before contacting a faculty member.
                </p>
              </div>
            )}
          </section>

          {/* NEXT STEP */}
          <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />

              <div>
                <h3 className="text-sm font-semibold">Next step</h3>

                <p className="mt-1 text-xs leading-6 text-slate-500">
                  Use the project brief and faculty matches to discuss
                  feasibility, datasets, supervision, and scope.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 sm:flex-shrink-0">
              <Link
                href="/project-ideas"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Compare other projects
              </Link>

              <Link
                href="/final-dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Final Dashboard
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
