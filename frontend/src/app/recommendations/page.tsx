 'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BookOpen,
  FileSearch,
  Heart,
  Search,
  User,
  X,
} from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

// ============================================================
// TYPES
// ============================================================

type Author = {
  name: string;
  id: string;
};

type Recommendation = {
  id: string;
  title: string;
  authors: Author[];
  summary?: string;
  abstract?: string;
  url: string;
  liked?: boolean;
  likes: number;
  date: string;
};

// ============================================================
// API
// ============================================================

const API_URL = 'http://127.0.0.1:5000';

// ============================================================
// HELPERS
// ============================================================

function getPaperAbstract(paper: Recommendation): string {
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

function getUsableResearchPapers(
  papers: Recommendation[]
): Recommendation[] {
  return papers
    .filter(
      (paper) => getPaperAbstract(paper).length > 0
    )
    .slice(0, 5);
}

// ============================================================
// MAIN CONTENT
// ============================================================

function RecommendationsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // ==========================================================
  // MAIN RECOMMENDATIONS
  // ==========================================================

  const [recommendations, setRecommendations] =
    useState<Recommendation[]>([]);

  const [originalRecommendations, setOriginalRecommendations] =
    useState<Recommendation[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] =
    useState<string | null>(null);

  // ==========================================================
  // ABSTRACT
  // ==========================================================

  const [showAbstractDialog, setShowAbstractDialog] =
    useState(false);

  const [activeAbstract, setActiveAbstract] =
    useState<string | null>(null);

  const [activeTitle, setActiveTitle] =
    useState<string>('');

  // ==========================================================
  // LIKES
  // ==========================================================

  const [likedRecommendations, setLikedRecommendations] =
    useState<Set<string>>(new Set());

  // ==========================================================
  // USER
  // ==========================================================

  const [email, setEmail] = useState('');

  // ==========================================================
  // SORTING
  // ==========================================================

  const [sortByYear, setSortByYear] =
    useState(false);

  // ==========================================================
  // MODE / TOPICS
  // ==========================================================

  const mode =
    searchParams.get('mode') || 'individual';

  let topics: string[] = [];

  if (mode === 'group') {
    searchParams.forEach((value, key) => {
      if (
        key.startsWith('member_') &&
        !key.endsWith('_institution')
      ) {
        topics = topics.concat(
          value
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        );
      }
    });
  } else {
    const topicsParam =
      searchParams.get('topics');

    topics = topicsParam
      ? topicsParam
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
  }

  const uniqueTopics = Array.from(
    new Set(topics)
  );

  const saveLastRecommendations = (
    papers: Recommendation[],
    currentEmail: string
  ) => {
    try {
      localStorage.setItem(
        `researchpilot:last-recommendations:${encodeURIComponent(
          currentEmail.toLowerCase()
        )}`,
        JSON.stringify({
          recommendations: papers,
          savedAt: new Date().toISOString(),
        })
      );
    } catch (err) {
      console.warn(
        'Could not save the latest recommendations:',
        err
      );
    }
  };

  // ==========================================================
  // LOAD EMAIL
  // ==========================================================

  useEffect(() => {
    const paramsEmail =
      searchParams.get('email');

    const storageEmail =
      typeof window !== 'undefined'
        ? localStorage.getItem('userEmail')
        : '';

    setEmail(
      paramsEmail ||
        storageEmail ||
        ''
    );
  }, [searchParams]);

  // ==========================================================
  // LIKE
  // ==========================================================

  const handleLike = async (
    workId: string
  ) => {
    if (!email) {
      alert('Please log in to like works.');
      return;
    }

    try {
      const res = await fetch(
        API_URL + '/like-work',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            workId,
            email,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(
          'Failed to update like.'
        );
      }

      const data = await res.json();

      setLikedRecommendations((prev) => {
        const next = new Set(prev);

        if (data.action === 'liked') {
          next.add(workId);
        } else if (data.action === 'unliked') {
          next.delete(workId);
        }

        return next;
      });

    } catch (err) {
      console.error(
        'Like error:',
        err
      );

      alert(
        'Failed to update like.'
      );
    }
  };

  // ==========================================================
  // SORT
  // ==========================================================

  const handleSortByYear = () => {
    setSortByYear((prev) => {
      if (!prev) {
        setRecommendations((current) =>
          [...current].sort((a, b) => {
            const aTime = a.date
              ? new Date(a.date).getTime()
              : 0;

            const bTime = b.date
              ? new Date(b.date).getTime()
              : 0;

            return bTime - aTime;
          })
        );
      } else {
        setRecommendations(
          originalRecommendations
        );
      }

      return !prev;
    });
  };

  // ==========================================================
  // RESEARCH GAP FLOW
  // ==========================================================

  const handleGenerateResearchGaps =
    () => {
      const papersWithAbstracts =
        getUsableResearchPapers(
          recommendations
        );

      if (
        papersWithAbstracts.length === 0
      ) {
        alert(
          'No recommended papers currently have usable abstracts. Research gap analysis cannot be performed.'
        );

        return;
      }

      const selectedPapers =
        papersWithAbstracts.map(
          (paper) => {
            const abstract =
              getPaperAbstract(
                paper
              );

            return {
              id: paper.id,
              title: paper.title,
              summary: abstract,
              abstract: abstract,
              authors: paper.authors,
              url: paper.url,
              date: paper.date,
            };
          }
        );

      try {
        sessionStorage.setItem(
          'researchGapPapers',
          JSON.stringify(
            selectedPapers
          )
        );

        sessionStorage.setItem(
          'researchGapTopics',
          JSON.stringify(topics)
        );

        sessionStorage.setItem(
          'researchGapEmail',
          email
        );

        sessionStorage.setItem(
          'researchGapPaperCount',
          String(
            selectedPapers.length
          )
        );

        router.push(
          '/research-gaps'
        );

      } catch (err) {
        console.error(
          'Failed to prepare research gap generation:',
          err
        );

        alert(
          'Could not prepare the research papers for research gap analysis.'
        );
      }
    };

  // ==========================================================
  // FETCH / RESTORE RECOMMENDATIONS
  // ==========================================================

  useEffect(() => {
    if (!email) return;

    let cancelled = false;

    const fetchBody: {
      mode: string;
      email: string;
      interests?: string[];
      members?: {
        topics: string[];
        institution: string;
      }[];
    } = {
      mode,
      email,
    };

    if (mode === 'group') {
      const memberIds = Array.from(searchParams.keys())
        .filter(
          (key) =>
            key.startsWith('member_') &&
            !key.endsWith('_institution')
        )
        .map((key) => key.split('_')[1])
        .filter((v, i, a) => a.indexOf(v) === i);

      fetchBody.members = memberIds.map((id) => ({
        topics: (
          searchParams.get('member_' + id) || ''
        )
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),

        institution:
          searchParams.get(
            'member_' + id + '_institution'
          ) || '',
      }));
    } else {
      fetchBody.interests = topics;
    }

    // Different users and input combinations get separate caches.
    const cacheKey =
      'researchpilot:recommendations:v1:' +
      encodeURIComponent(email.toLowerCase()) +
      ':' +
      encodeURIComponent(
        JSON.stringify({
          mode,
          params: searchParams.toString(),
          request: fetchBody,
        })
      );

    const loadRecommendations = async () => {
      setLoading(true);
      setError(null);

      // Restore the latest recommendations when navigating
      // back to this page without the original URL parameters.
      const hasRequestInputs =
        mode === 'group'
          ? Boolean(
              fetchBody.members?.some(
                (member) => member.topics.length > 0
              )
            )
          : Boolean(
              fetchBody.interests?.some(
                (topic) => topic.trim().length > 0
              )
            );

      if (!hasRequestInputs) {
        try {
          const lastSaved = localStorage.getItem(
            `researchpilot:last-recommendations:${encodeURIComponent(
              email.toLowerCase()
            )}`
          );

          if (lastSaved) {
            const savedData = JSON.parse(lastSaved);

            if (
              Array.isArray(savedData.recommendations)
            ) {
              const papers: Recommendation[] =
                savedData.recommendations;

              if (cancelled) return;

              saveLastRecommendations(papers, email);
              setRecommendations(papers);
              setOriginalRecommendations(papers);

              setLikedRecommendations(
                new Set(
                  papers
                    .filter((paper) => paper.liked)
                    .map((paper) => paper.id)
                )
              );

              setSortByYear(false);
              setError(null);
              setLoading(false);

              console.log(
                'Restored latest recommendations without requesting new results.'
              );

              return;
            }
          }
        } catch (err) {
          console.warn(
            'Could not restore the latest recommendations:',
            err
          );
        }

        if (!cancelled) {
          setError(
            'No interests were provided, and no saved recommendations were found. Please return to the interests page and generate recommendations.'
          );
          setLoading(false);
        }

        return;
      }

      // First restore the saved result.
      try {
        const saved = localStorage.getItem(cacheKey);

        if (saved) {
          const cached = JSON.parse(saved);

          if (
            Array.isArray(cached.recommendations)
          ) {
            if (cancelled) return;

            const papers: Recommendation[] =
              cached.recommendations;

            saveLastRecommendations(papers, email);
            setRecommendations(papers);
            setOriginalRecommendations(papers);

            setLikedRecommendations(
              new Set(
                papers
                  .filter((paper) => paper.liked)
                  .map((paper) => paper.id)
              )
            );

            setSortByYear(false);
            setLoading(false);
            return;
          }
        }
      } catch (cacheError) {
        console.warn(
          'Could not restore cached recommendations:',
          cacheError
        );
      }

      // Only call Flask when no valid cached result exists.
      try {
        const res = await fetch(
          API_URL + '/recommendations',
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(fetchBody),
          }
        );

        if (!res.ok) {
          let errorMessage =
            'Failed to load recommendations.';

          try {
            const errorData = await res.json();

            if (typeof errorData.error === 'string') {
              errorMessage = errorData.error;
            }
          } catch {
            // Response was not JSON.
          }

          throw new Error(errorMessage);
        }

        const data = await res.json();

        const papers: Recommendation[] =
          Array.isArray(data.recommendations)
            ? data.recommendations
            : [];

        if (cancelled) return;

        // Cache the raw generated result, not the sorted display.
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              recommendations: papers,
              savedAt: new Date().toISOString(),
            })
          );
        } catch (storageError) {
          console.warn(
            'Could not save recommendations:',
            storageError
          );
        }

        saveLastRecommendations(papers, email);
        setRecommendations(papers);
        setOriginalRecommendations(papers);

        setLikedRecommendations(
          new Set(
            papers
              .filter((paper) => paper.liked)
              .map((paper) => paper.id)
          )
        );

        setSortByYear(false);
        setError(null);
      } catch (e) {
        if (cancelled) return;

        console.error(
          'Recommendation fetch error:',
          e
        );

        setError(
          e instanceof Error
            ? e.message
            : 'Failed to load recommendations.'
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [searchParams, email, mode]);

  // ==========================================================
  // COUNTS
  // ==========================================================

  const usableAbstractCount =
    recommendations.filter(
      (paper) =>
        getPaperAbstract(
          paper
        ).length > 0
    ).length;

  // ==========================================================
  // ABSTRACT MODAL
  // ==========================================================

  const openAbstract = (
    paper: Recommendation
  ) => {
    setActiveTitle(
      paper.title
    );

    setActiveAbstract(
      getPaperAbstract(
        paper
      ) ||
        'No abstract available.'
    );

    setShowAbstractDialog(true);
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900">

      {/* ====================================================== */}
      {/* ABSTRACT MODAL */}
      {/* ====================================================== */}

      {showAbstractDialog && (
        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-slate-900/30
            p-5
            backdrop-blur-sm
          "
        >

          <div
            className="
              relative
              max-h-[85vh]
              w-full
              max-w-3xl
              overflow-hidden
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-2xl
            "
          >

            <button
              type="button"
              onClick={() =>
                setShowAbstractDialog(false)
              }
              className="
                absolute
                right-5
                top-5
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-lg
                border
                border-slate-200
                bg-white
                text-slate-500
                transition
                hover:bg-slate-50
                hover:text-slate-900
              "
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="max-h-[85vh] overflow-y-auto p-7 md:p-9">

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Research paper
              </p>

              <h2 className="mt-2 pr-12 text-xl font-semibold leading-7 text-slate-900">
                {activeTitle}
              </h2>

              <div className="my-6 h-px bg-slate-100" />

              <p className="whitespace-pre-line text-sm leading-7 text-slate-600">
                {activeAbstract}
              </p>

              <div className="mt-8 flex justify-end">

                <button
                  type="button"
                  onClick={() =>
                    setShowAbstractDialog(false)
                  }
                  className="
                    rounded-lg
                    bg-slate-900
                    px-5
                    py-2.5
                    text-sm
                    font-medium
                    text-white
                    transition
                    hover:bg-slate-800
                  "
                >
                  Close
                </button>

              </div>

            </div>

          </div>

        </div>
      )}


      {/* ====================================================== */}
      {/* HEADER */}
      {/* ====================================================== */}

      <header className="border-b border-slate-200 bg-white">

        <div
          className="
            mx-auto
            flex
            h-20
            w-full
            max-w-7xl
            items-center
            justify-between
            px-6
            md:px-8
          "
        >

          <Link
            href="/interests"
            className="
              inline-flex
              items-center
              gap-2
              text-sm
              font-medium
              text-slate-500
              transition
              hover:text-slate-900
            "
          >
            <ArrowLeft className="h-4 w-4" />
            Research profile
          </Link>


          <Link
            href="/recommendation-type"
            className="
              absolute
              left-1/2
              hidden
              -translate-x-1/2
              text-center
              sm:block
            "
          >

            <div className="text-lg font-semibold tracking-tight text-slate-900">
              RESEARCHPILOT
            </div>

            <div className="text-[11px] text-slate-400">
              Research discovery & guidance
            </div>

          </Link>


          <Link
            href={
              '/account_view?returnTo=' +
              encodeURIComponent(
                '/recommendations?' +
                  searchParams.toString()
              )
            }
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              border
              border-slate-200
              bg-white
              px-3.5
              py-2
              text-sm
              font-medium
              text-slate-600
              transition
              hover:border-slate-300
              hover:bg-slate-50
              hover:text-slate-900
            "
          >
            <User className="h-4 w-4" />

            <span className="hidden sm:inline">
              Profile
            </span>
          </Link>

        </div>

      </header>


      {/* ====================================================== */}
      {/* MAIN */}
      {/* ====================================================== */}

      <div
        className="
          mx-auto
          w-full
          max-w-7xl
          px-6
          py-10
          md:px-8
          md:py-14
        "
      >

        {/* ==================================================== */}
        {/* FULL RESEARCHPILOT PROGRESS */}
        {/* ==================================================== */}

        <div className="mb-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-3">

          {/* STEP 1 — INACTIVE */}
          <div className="flex items-center gap-2">
            <div
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-full
                bg-slate-100
                text-xs
                font-semibold
                text-slate-400
              "
            >
              1
            </div>

            <span className="text-sm font-medium text-slate-400">
              Research Profile
            </span>
          </div>

          <div className="h-px w-8 bg-slate-200 sm:w-10" />

          {/* STEP 2 — ACTIVE */}
          <div className="flex items-center gap-2">
            <div
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-full
                bg-slate-900
                text-xs
                font-semibold
                text-white
              "
            >
              2
            </div>

            <span className="text-sm font-semibold text-slate-900">
              Paper Recommendations
            </span>
          </div>

          <div className="h-px w-8 bg-slate-200 sm:w-10" />

          {/* STEP 3 — INACTIVE */}
          <div className="flex items-center gap-2">
            <div
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-full
                bg-slate-100
                text-xs
                font-semibold
                text-slate-400
              "
            >
              3
            </div>

            <span className="text-sm font-medium text-slate-400">
              Research Gaps
            </span>
          </div>

          <div className="h-px w-8 bg-slate-200 sm:w-10" />

          {/* STEP 4 — INACTIVE */}
          <div className="flex items-center gap-2">
            <div
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-full
                bg-slate-100
                text-xs
                font-semibold
                text-slate-400
              "
            >
              4
            </div>

            <span className="text-sm font-medium text-slate-400">
              Project Ideas
            </span>
          </div>

          <div className="h-px w-8 bg-slate-200 sm:w-10" />

          {/* STEP 5 — INACTIVE */}
          <div className="flex items-center gap-2">
            <div
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-full
                bg-slate-100
                text-xs
                font-semibold
                text-slate-400
              "
            >
              5
            </div>

            <span className="text-sm font-medium text-slate-400">
              Faculty Assignment
            </span>
          </div>

          <div className="h-px w-8 bg-slate-200 sm:w-10" />

          {/* STEP 6 — INACTIVE */}
          <div className="flex items-center gap-2">
            <div
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-full
                bg-slate-100
                text-xs
                font-semibold
                text-slate-400
              "
            >
              6
            </div>

            <span className="text-sm font-medium text-slate-400">
              Final Dashboard
            </span>
          </div>

        </div>


        {/* ==================================================== */}
        {/* PAGE HEADER — CENTERED */}
        {/* ==================================================== */}

        <div className="mb-8 text-center">

          <div className="flex flex-col items-center gap-6">

            <div className="mx-auto max-w-3xl">

              <div className="mb-3 flex items-center justify-center gap-2">

                <div
                  className="
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-lg
                    bg-slate-900
                    text-white
                  "
                >
                  <BookOpen className="h-4 w-4" />
                </div>

                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Research discovery
                </span>

              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Your Research Recommendations
              </h1>

              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500 md:text-base">
                Research papers selected based on your
                interests and research goals.
              </p>

            </div>

          </div>


          {/* ================================================= */}
          {/* TOPICS */}
          {/* ================================================= */}

          {uniqueTopics.length > 0 && (

            <div className="mt-6 flex flex-wrap justify-center gap-2">

              {uniqueTopics.map(
                (topic, index) => (

                  <span
                    key={`${topic}-${index}`}
                    className="
                      inline-flex
                      items-center
                      rounded-full
                      border
                      border-slate-200
                      bg-white
                      px-3
                      py-1.5
                      text-xs
                      font-medium
                      text-slate-600
                    "
                  >
                    {topic}
                  </span>

                )
              )}

            </div>

          )}

        </div>


        {/* ==================================================== */}
        {/* TOOLBAR */}
        {/* ==================================================== */}

        <div
          className="
            mb-8
            flex
            flex-col
            gap-4
            border-b
            border-slate-200
            pb-4
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >

          <div>

            {!loading &&
              !error && (
                <p className="text-sm text-slate-500">

                  <span className="font-medium text-slate-900">
                    {recommendations.length}
                  </span>{' '}

                  research papers found

                </p>
              )}

          </div>


          <button
            type="button"
            onClick={
              handleSortByYear
            }
            disabled={
              loading ||
              recommendations.length === 0
            }
            className="
              inline-flex
              shrink-0
              items-center
              gap-2
              self-start
              rounded-lg
              border
              border-slate-200
              bg-white
              px-3.5
              py-2
              text-sm
              font-medium
              text-slate-600
              transition
              hover:border-slate-300
              hover:bg-slate-50
              hover:text-slate-900
              disabled:cursor-not-allowed
              disabled:opacity-50
              sm:self-auto
            "
          >
            <ArrowUpDown className="h-4 w-4" />

            {sortByYear
              ? 'Original order'
              : 'Sort by year'}

          </button>

        </div>


        {/* ==================================================== */}
        {/* LOADING */}
        {/* ==================================================== */}

        {loading && (

          <div
            className="
              grid
              grid-cols-1
              gap-5
              md:grid-cols-2
              lg:grid-cols-3
            "
          >

            {[...Array(6)].map(
              (_, index) => (

                <div
                  key={index}
                  className="
                    rounded-2xl
                    border
                    border-slate-200
                    bg-white
                    p-6
                    shadow-sm
                  "
                >

                  <div className="flex items-center justify-between">

                    <Skeleton className="h-6 w-24" />

                    <Skeleton className="h-9 w-9 rounded-full" />

                  </div>

                  <Skeleton className="mt-5 h-5 w-4/5" />

                  <Skeleton className="mt-3 h-3 w-2/3" />

                  <Skeleton className="mt-7 h-3 w-full" />

                  <Skeleton className="mt-2 h-3 w-full" />

                  <Skeleton className="mt-2 h-3 w-4/5" />

                  <div className="mt-8 flex justify-between">

                    <Skeleton className="h-8 w-28" />

                    <Skeleton className="h-8 w-20" />

                  </div>

                </div>

              )
            )}

          </div>

        )}


        {/* ==================================================== */}
        {/* ERROR */}
        {/* ==================================================== */}

        {!loading &&
          error && (

            <div
              className="
                rounded-2xl
                border
                border-red-200
                bg-white
                p-10
                text-center
              "
            >

              <div
                className="
                  mx-auto
                  flex
                  h-11
                  w-11
                  items-center
                  justify-center
                  rounded-full
                  bg-red-50
                  text-red-500
                "
              >
                <Search className="h-5 w-5" />
              </div>

              <h2 className="mt-4 font-semibold text-slate-900">
                We couldn't load your recommendations
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {error}
              </p>

            </div>

          )}


        {/* ==================================================== */}
        {/* EMPTY STATE */}
        {/* ==================================================== */}

        {!loading &&
          !error &&
          recommendations.length === 0 && (

            <div
              className="
                rounded-2xl
                border
                border-slate-200
                bg-white
                p-12
                text-center
              "
            >

              <BookOpen className="mx-auto h-8 w-8 text-slate-300" />

              <h2 className="mt-4 font-semibold text-slate-900">
                No recommendations found
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Try returning to your research profile and
                selecting different or broader interests.
              </p>

              <Link
                href="/interests"
                className="
                  mt-6
                  inline-flex
                  items-center
                  gap-2
                  rounded-lg
                  bg-slate-900
                  px-4
                  py-2.5
                  text-sm
                  font-medium
                  text-white
                  transition
                  hover:bg-slate-800
                "
              >
                <ArrowLeft className="h-4 w-4" />
                Back to research profile
              </Link>

            </div>

          )}


        {/* ==================================================== */}
        {/* MAIN PAPERS */}
        {/* ==================================================== */}

        {!loading &&
          !error &&
          recommendations.length > 0 && (

            <div
              className="
                grid
                grid-cols-1
                gap-5
                md:grid-cols-2
                lg:grid-cols-3
              "
            >

              {recommendations.map(
                (rec) => {

                  const liked =
                    likedRecommendations.has(
                      rec.id
                    );

                  const abstract =
                    getPaperAbstract(
                      rec
                    );

                  return (

                    <article
                      key={rec.id}
                      className="
                        group
                        relative
                        flex
                        min-h-[330px]
                        flex-col
                        overflow-hidden
                        rounded-2xl
                        border
                        border-slate-200
                        bg-white
                        shadow-sm
                        transition-all
                        duration-200
                        hover:-translate-y-1
                        hover:border-slate-300
                        hover:shadow-lg
                      "
                    >

                      {/* TOP */}

                      <div className="flex items-start justify-between px-6 pt-6">

                        <span
                          className="
                            inline-flex
                            items-center
                            rounded-full
                            bg-slate-100
                            px-2.5
                            py-1
                            text-[11px]
                            font-medium
                            text-slate-500
                          "
                        >
                          Research paper
                        </span>


                        <button
                          type="button"
                          onClick={() =>
                            handleLike(
                              rec.id
                            )
                          }
                          className={`
                            flex
                            h-9
                            w-9
                            items-center
                            justify-center
                            rounded-full
                            border
                            transition
                            ${
                              liked
                                ? 'border-red-100 bg-red-50 text-red-500'
                                : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                            }
                          `}
                          aria-label={
                            liked
                              ? 'Unlike'
                              : 'Like'
                          }
                        >
                          <Heart
                            className={`h-4 w-4 ${
                              liked
                                ? 'fill-current'
                                : ''
                            }`}
                          />
                        </button>

                      </div>


                      {/* CONTENT */}

                      <div className="flex flex-1 flex-col px-6 pb-6 pt-5">

                        <a
                          href={
                            rec.url || '#'
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >

                          <h2
                            className="
                              line-clamp-3
                              text-lg
                              font-semibold
                              leading-7
                              text-slate-900
                              transition-colors
                              group-hover:text-slate-700
                            "
                          >
                            {rec.title}
                          </h2>

                        </a>


                        <p
                          className="
                            mt-3
                            line-clamp-2
                            text-xs
                            leading-5
                            text-slate-400
                          "
                        >
                          {rec.authors
                            .map(
                              (author) =>
                                author.name
                            )
                            .join(
                              ', '
                            )}
                        </p>


                        {abstract ? (
                          <p
                            className="
                              mt-5
                              line-clamp-4
                              text-sm
                              leading-6
                              text-slate-500
                            "
                          >
                            {abstract}
                          </p>
                        ) : (
                          <p
                            className="
                              mt-5
                              text-sm
                              italic
                              text-slate-400
                            "
                          >
                            No abstract available.
                          </p>
                        )}


                        {/* BOTTOM */}

                        <div className="mt-auto flex items-center justify-between pt-6">

                          <button
                            type="button"
                            onClick={() =>
                              openAbstract(
                                rec
                              )
                            }
                            className="
                              inline-flex
                              items-center
                              gap-2
                              rounded-lg
                              border
                              border-slate-200
                              px-3
                              py-2
                              text-xs
                              font-medium
                              text-slate-600
                              transition
                              hover:bg-slate-50
                              hover:text-slate-900
                            "
                          >
                            <Search className="h-3.5 w-3.5" />
                            Read abstract
                          </button>


                          <a
                            href={
                              rec.url ||
                              '#'
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="
                              text-xs
                              font-medium
                              text-slate-400
                              transition
                              hover:text-slate-900
                            "
                          >
                            View paper →
                          </a>

                        </div>

                      </div>

                    </article>

                  );

                }
              )}

            </div>

          )}


        {/* ==================================================== */}
        {/* NEXT STEP — IDENTIFY RESEARCH GAPS */}
        {/* ==================================================== */}

        {!loading &&
          !error &&
          recommendations.length > 0 && (

            <section className="mt-14">
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md">

                <div className="absolute inset-y-0 left-0 w-1 bg-slate-900" />

                <div className="flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center md:justify-between md:gap-8">

                  <div className="flex items-start gap-4">

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                      <FileSearch className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">

                      <div className="mb-2 flex flex-wrap items-center gap-2">

                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Next stage
                        </span>

                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                          Step 3 of 6
                        </span>

                      </div>

                      <h2 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
                        Discover Research Gaps
                      </h2>

                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        Move beyond paper recommendations. Analyze your selected research papers to identify unexplored areas, limitations in existing work, and opportunities for new research.
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">

                        <span className="inline-flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5" />
                          {Math.min(usableAbstractCount, 5)} papers with abstracts
                        </span>

                        <span className="inline-flex items-center gap-1.5">
                          <Search className="h-3.5 w-3.5" />
                          Evidence-based analysis
                        </span>

                      </div>

                    </div>

                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">

                    <button
                      type="button"
                      onClick={handleGenerateResearchGaps}
                      disabled={usableAbstractCount === 0}
                      className="
                        group/button
                        inline-flex
                        min-h-12
                        items-center
                        justify-center
                        gap-3
                        rounded-xl
                        bg-slate-900
                        px-5
                        py-3
                        text-sm
                        font-semibold
                        text-white
                        shadow-sm
                        transition-all
                        duration-200
                        hover:bg-slate-800
                        hover:shadow-md
                        disabled:cursor-not-allowed
                        disabled:bg-slate-200
                        disabled:text-slate-400
                        disabled:shadow-none
                      "
                      title={
                        usableAbstractCount > 0
                          ? `Identify research gaps using ${Math.min(
                              usableAbstractCount,
                              5
                            )} available papers`
                          : 'No recommended papers currently have usable abstracts'
                      }
                    >
                      Identify Research Gaps

                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 transition-transform duration-200 group-hover/button:translate-x-0.5 group-hover/button:bg-white/15">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </button>

                    <p className="self-center text-center text-xs text-slate-400 sm:max-w-32 md:max-w-none lg:max-w-28 lg:text-left">
                      Continue your research journey
                    </p>

                  </div>

                </div>

              </div>
            </section>

          )}

      </div>

    </main>
  );
}

// ============================================================
// PAGE
// ============================================================

export default function RecommendationsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f8fafc] px-6 py-20 text-center text-sm text-slate-500">
          Loading your recommendations...
        </main>
      }
    >
      <RecommendationsContent />
    </Suspense>
  );
}