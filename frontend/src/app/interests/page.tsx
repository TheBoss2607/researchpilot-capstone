'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  User,
  Target,
  BookOpen,
  Search,
  Sparkles,
  X,
  Check,
} from 'lucide-react';

const suggestedInterests = [
  'Artificial Intelligence',
  'Machine Learning',
  'Deep Learning',
  'Computer Vision',
  'Natural Language Processing',
  'Data Science',
  'Cybersecurity',
  'Blockchain',
  'Internet of Things',
  'Robotics',
  'Big Data',
  'Human-Computer Interaction',
];

const goals = [
  {
    id: 'project',
    title: 'Find a Project Idea',
    description:
      'Discover research directions that can become a meaningful project.',
  },
  {
    id: 'research',
    title: 'Explore Research',
    description:
      'Find papers and topics that match your academic interests.',
  },
  {
    id: 'gap',
    title: 'Find Research Gaps',
    description:
      'Identify areas where existing research is incomplete.',
  },
  {
    id: 'career',
    title: 'Build Research Expertise',
    description:
      'Explore topics aligned with your long-term academic goals.',
  },
];

function removeItem(items: string[], item: string) {
  return items.filter((value) => value !== item);
}

export default function InterestsPage() {
  const [interests, setInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('project');

  const addInterest = (interest: string) => {
    const cleaned = interest.trim();

    if (!cleaned) return;

    if (
      interests.some(
        (item) => item.toLowerCase() === cleaned.toLowerCase()
      )
    ) {
      return;
    }

    setInterests([...interests, cleaned]);
    setCustomInterest('');
  };

  const handleCustomInterest = () => {
    addInterest(customInterest);
  };

  const selectedGoalData = goals.find(
    (goal) => goal.id === selectedGoal
  );

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900">

      {/* ========================================================= */}
      {/* TOP NAVIGATION */}
      {/* ========================================================= */}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6 md:px-8">

          <Link
            href="/recommendation-type"
            className="
              inline-flex
              items-center
              gap-2
              text-sm
              font-medium
              text-slate-500
              transition-colors
              hover:text-slate-900
            "
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>


          <div className="absolute left-1/2 hidden -translate-x-1/2 text-center sm:block">
            <Link
              href="/recommendation-type"
              className="text-lg font-semibold tracking-tight text-slate-900"
            >
              RESEARCHPILOT
            </Link>

            <p className="text-[11px] text-slate-400">
              Research discovery & guidance
            </p>
          </div>


          <Link
            href="/account_view?returnTo=/interests"
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
              transition-all
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


      {/* ========================================================= */}
      {/* MAIN */}
      {/* ========================================================= */}

      <main className="mx-auto w-full max-w-5xl px-6 py-12 md:px-8 md:py-16">

        {/* ======================================================= */}
        {/* FULL RESEARCHPILOT PROGRESS */}
        {/* ======================================================= */}

        <div className="mb-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-3">

          {/* STEP 1 — ACTIVE */}
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
              1
            </div>

            <span className="text-sm font-semibold text-slate-900">
              Research Profile
            </span>
          </div>

          <div className="h-px w-8 bg-slate-200 sm:w-10" />

          {/* STEP 2 — INACTIVE */}
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
              2
            </div>

            <span className="text-sm font-medium text-slate-400">
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


        {/* ======================================================= */}
        {/* PAGE INTRO */}
        {/* ======================================================= */}

        <div className="mx-auto mb-10 max-w-2xl text-center">

          <div
            className="
              mx-auto
              mb-5
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-slate-900
              text-white
            "
          >
            <Sparkles className="h-5 w-5" />
          </div>

          <p className="mb-2 text-sm font-medium text-slate-500">
            PERSONALIZE YOUR DISCOVERY
          </p>

          <h1
            className="
              text-3xl
              font-semibold
              tracking-tight
              text-slate-900
              md:text-4xl
            "
          >
            Tell us what you want to research
          </h1>

          <p
            className="
              mx-auto
              mt-4
              max-w-xl
              text-base
              leading-7
              text-slate-500
            "
          >
            Share a few areas you are interested in and what you
            want to achieve. ResearchPilot will use this information
            to personalize your research recommendations.
          </p>

        </div>


        {/* ======================================================= */}
        {/* INTERESTS CARD */}
        {/* ======================================================= */}

        <section
          className="
            rounded-2xl
            border
            border-slate-200
            bg-white
            shadow-sm
          "
        >

          <div className="border-b border-slate-100 px-6 py-6 md:px-8">

            <div className="flex items-start gap-4">

              <div
                className="
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  bg-slate-100
                  text-slate-700
                "
              >
                <BookOpen className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Research interests
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Select the topics you would like ResearchPilot
                  to consider.
                </p>
              </div>

            </div>

          </div>


          <div className="p-6 md:p-8">

            {/* ================================================= */}
            {/* SELECTED */}
            {/* ================================================= */}

            {interests.length > 0 && (
              <div className="mb-8">

                <div className="mb-3 flex items-center justify-between">

                  <p className="text-sm font-medium text-slate-700">
                    Selected topics
                  </p>

                  <span className="text-xs text-slate-400">
                    {interests.length} selected
                  </span>

                </div>

                <div className="flex flex-wrap gap-2">

                  {interests.map((interest) => (

                    <div
                      key={interest}
                      className="
                        inline-flex
                        items-center
                        gap-2
                        rounded-lg
                        border
                        border-slate-200
                        bg-slate-50
                        px-3
                        py-2
                        text-sm
                        font-medium
                        text-slate-700
                      "
                    >

                      <Check className="h-3.5 w-3.5 text-slate-600" />

                      <span>{interest}</span>

                      <button
                        type="button"
                        onClick={() =>
                          setInterests(
                            removeItem(interests, interest)
                          )
                        }
                        className="
                          ml-1
                          rounded
                          p-0.5
                          text-slate-400
                          transition-colors
                          hover:bg-slate-200
                          hover:text-slate-700
                        "
                        aria-label={`Remove ${interest}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>

                    </div>

                  ))}

                </div>

              </div>
            )}


            {/* ================================================= */}
            {/* SUGGESTED TOPICS */}
            {/* ================================================= */}

            <div>

              <p className="mb-3 text-sm font-medium text-slate-700">
                Suggested topics
              </p>

              <div className="flex flex-wrap gap-2">

                {suggestedInterests.map((interest) => {

                  const selected = interests.some(
                    (item) =>
                      item.toLowerCase() === interest.toLowerCase()
                  );

                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => addInterest(interest)}
                      disabled={selected}
                      className={`
                        rounded-lg
                        border
                        px-3.5
                        py-2
                        text-sm
                        transition-all
                        ${
                          selected
                            ? 'cursor-default border-slate-200 bg-slate-100 text-slate-400'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900'
                        }
                      `}
                    >
                      {selected ? (
                        <span className="mr-1.5">✓</span>
                      ) : (
                        <span className="mr-1.5 text-slate-400">+</span>
                      )}

                      {interest}
                    </button>
                  );

                })}

              </div>

            </div>


            {/* ================================================= */}
            {/* CUSTOM TOPIC */}
            {/* ================================================= */}

            <div className="mt-8">

              <label
                htmlFor="custom-interest"
                className="mb-3 block text-sm font-medium text-slate-700"
              >
                Add another topic
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">

                <input
                  id="custom-interest"
                  value={customInterest}
                  onChange={(event) =>
                    setCustomInterest(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleCustomInterest();
                    }
                  }}
                  placeholder="e.g. Explainable AI"
                  className="
                    h-11
                    flex-1
                    rounded-lg
                    border
                    border-slate-200
                    bg-white
                    px-4
                    text-sm
                    text-slate-900
                    outline-none
                    placeholder:text-slate-400
                    transition
                    focus:border-slate-400
                    focus:ring-2
                    focus:ring-slate-100
                  "
                />

                <button
                  type="button"
                  onClick={handleCustomInterest}
                  className="
                    h-11
                    rounded-lg
                    bg-slate-900
                    px-5
                    text-sm
                    font-medium
                    text-white
                    transition-colors
                    hover:bg-slate-800
                  "
                >
                  Add topic
                </button>

              </div>

            </div>

          </div>

        </section>


        {/* ======================================================= */}
        {/* GOAL */}
        {/* ======================================================= */}

        <section
          className="
            mt-6
            rounded-2xl
            border
            border-slate-200
            bg-white
            shadow-sm
          "
        >

          <div className="border-b border-slate-100 px-6 py-6 md:px-8">

            <div className="flex items-start gap-4">

              <div
                className="
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  bg-slate-100
                  text-slate-700
                "
              >
                <Target className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  What is your main goal?
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Choose the outcome you are primarily looking for.
                </p>
              </div>

            </div>

          </div>


          <div className="grid grid-cols-1 gap-3 p-6 md:grid-cols-2 md:p-8">

            {goals.map((goal) => {

              const selected = selectedGoal === goal.id;

              return (

                <button
                  key={goal.id}
                  type="button"
                  onClick={() => setSelectedGoal(goal.id)}
                  className={`
                    group
                    rounded-xl
                    border
                    p-5
                    text-left
                    transition-all
                    ${
                      selected
                        ? 'border-slate-900 bg-slate-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }
                  `}
                >

                  <div className="flex items-start gap-4">

                    <div
                      className={`
                        mt-0.5
                        flex
                        h-5
                        w-5
                        shrink-0
                        items-center
                        justify-center
                        rounded-full
                        border
                        ${
                          selected
                            ? 'border-slate-900 bg-slate-900'
                            : 'border-slate-300 bg-white'
                        }
                      `}
                    >
                      {selected && (
                        <div className="h-2 w-2 rounded-full bg-white" />
                      )}
                    </div>


                    <div className="flex-1">

                      <h3
                        className={`
                          text-sm
                          font-semibold
                          ${
                            selected
                              ? 'text-slate-900'
                              : 'text-slate-700'
                          }
                        `}
                      >
                        {goal.title}
                      </h3>

                      <p className="mt-1.5 text-sm leading-6 text-slate-500">
                        {goal.description}
                      </p>

                    </div>

                  </div>

                </button>

              );

            })}

          </div>

        </section>


        {/* ======================================================= */}
        {/* PROFILE SUMMARY */}
        {/* ======================================================= */}

        <section
          className="
            mt-6
            rounded-2xl
            border
            border-slate-200
            bg-slate-50
            p-6
            md:p-7
          "
        >

          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Your research profile
              </p>

              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                Ready to personalize your discovery
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                ResearchPilot will use your selections to guide
                your recommendations.
              </p>

            </div>


            <div className="flex shrink-0 gap-3">

              <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center">
                <p className="text-xl font-semibold text-slate-900">
                  {interests.length}
                </p>

                <p className="mt-0.5 text-xs text-slate-400">
                  interests
                </p>
              </div>

              <div className="max-w-[180px] rounded-xl border border-slate-200 bg-white px-5 py-3">

                <p className="truncate text-sm font-semibold text-slate-900">
                  {selectedGoalData?.title}
                </p>

                <p className="mt-0.5 text-xs text-slate-400">
                  primary goal
                </p>

              </div>

            </div>

          </div>

        </section>


        {/* ======================================================= */}
        {/* CONTINUE */}
        {/* ======================================================= */}

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-2 text-sm text-slate-500">

            <Search className="h-4 w-4 shrink-0" />

            {interests.length === 0 ? (
              <span>
                Select at least one topic to continue.
              </span>
            ) : (
              <span>
                {interests.length} research interest
                {interests.length === 1 ? '' : 's'} selected.
              </span>
            )}

          </div>


          <Link
            href={`/recommendations?mode=individual&topics=${encodeURIComponent(
              interests.join(',')
            )}`}
            className={`
              group
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-lg
              px-6
              py-3
              text-sm
              font-medium
              transition-all
              ${
                interests.length === 0
                  ? 'pointer-events-none bg-slate-200 text-slate-400'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }
            `}
          >

            Generate Recommendations

            <ArrowRight
              className="
                h-4
                w-4
                transition-transform
                group-hover:translate-x-1
              "
            />

          </Link>

        </div>


        {/* ======================================================= */}
        {/* FOOTER */}
        {/* ======================================================= */}

        <div className="mt-12 border-t border-slate-200 pt-6 text-center">

          <p className="text-xs text-slate-400">
            RESEARCHPILOT · Goal-aware personalized research discovery
          </p>

        </div>

      </main>

    </main>
  );
}