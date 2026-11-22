'use client';

import Link from 'next/link';
import {
  BookOpen,
  Search,
  Lightbulb,
  Users,
  Network,
  FileSearch,
  Brain,
  User,
  LogOut,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export default function DashboardPage() {
  return (
    <main className="relative min-h-screen w-full bg-[#030303] text-white overflow-hidden">

      {/* ===================================================== */}
      {/* BACKGROUND */}
      {/* ===================================================== */}

      <div className="fixed inset-0 pointer-events-none">

        <div
          className="
            absolute inset-0
            bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),
            linear-gradient(to_bottom,#80808008_1px,transparent_1px)]
            bg-[size:60px_60px]
          "
        />

        <div
          className="
            absolute top-[-300px] left-1/2
            -translate-x-1/2
            w-[700px] h-[700px]
            rounded-full
            bg-primary/10
            blur-[150px]
          "
        />

      </div>


      {/* ===================================================== */}
      {/* NAVBAR */}
      {/* ===================================================== */}

      <nav
        className="
          relative z-20
          w-full
          border-b border-white/10
          bg-black/30
          backdrop-blur-xl
        "
      >

        <div
          className="
            max-w-7xl
            mx-auto
            px-6
            py-4
            flex
            items-center
            justify-between
          "
        >

          {/* LOGO */}

          <Link
            href="/dashboard"
            className="flex items-center gap-3"
          >

            <div
              className="
                h-10 w-10
                rounded-xl
                bg-primary/15
                border border-primary/30
                flex items-center justify-center
              "
            >
              <Sparkles className="h-5 w-5 text-primary" />
            </div>

            <div>

              <h1 className="text-lg font-bold tracking-tight">
                RESEARCHPILOT
              </h1>

              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Research Intelligence
              </p>

            </div>

          </Link>


          {/* NAVIGATION */}

          <div className="flex items-center gap-2">

            <Link
              href="/account_view?returnTo=/dashboard"
              className="
                flex items-center gap-2
                px-4 py-2
                rounded-lg
                text-sm
                text-muted-foreground
                hover:text-white
                hover:bg-white/5
                transition
              "
            >

              <User className="h-4 w-4" />

              <span className="hidden sm:inline">
                Profile
              </span>

            </Link>

          </div>

        </div>

      </nav>


      {/* ===================================================== */}
      {/* MAIN CONTENT */}
      {/* ===================================================== */}

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">


        {/* =================================================== */}
        {/* HEADER */}
        {/* =================================================== */}

        <section className="mb-12">

          <div className="max-w-3xl">

            <div
              className="
                inline-flex
                items-center
                gap-2
                px-3
                py-1.5
                rounded-full
                border border-primary/20
                bg-primary/5
                text-primary
                text-xs
                font-medium
                mb-5
              "
            >

              <Sparkles className="h-3.5 w-3.5" />

              AI-Powered Research Discovery

            </div>


            <h2
              className="
                text-4xl
                md:text-5xl
                font-bold
                tracking-tight
                leading-tight
              "
            >

              Turn your interests into
              <span className="text-primary">
                {' '}research.
              </span>

            </h2>


            <p
              className="
                mt-5
                text-lg
                text-muted-foreground
                max-w-2xl
                leading-relaxed
              "
            >

              Discover relevant research, identify unexplored gaps,
              generate project ideas, and connect with researchers
              whose expertise matches your goals.

            </p>

          </div>

        </section>


        {/* =================================================== */}
        {/* CORE RESEARCH WORKFLOW */}
        {/* =================================================== */}

        <section className="mb-12">

          <div className="flex items-center justify-between mb-5">

            <div>

              <h3 className="text-xl font-semibold">
                Research Workspace
              </h3>

              <p className="text-sm text-muted-foreground mt-1">
                Start with a research discovery task.
              </p>

            </div>

          </div>


          <div
            className="
              grid
              grid-cols-1
              md:grid-cols-2
              lg:grid-cols-3
              gap-5
            "
          >


            {/* ================================================= */}
            {/* ARTICLE DISCOVERY */}
            {/* ================================================= */}

            <Link
              href="/recommendation-type"
              className="group"
            >

              <div
                className="
                  h-full
                  rounded-2xl
                  border border-white/10
                  bg-white/[0.03]
                  backdrop-blur-xl
                  p-6
                  transition-all
                  duration-300
                  hover:-translate-y-1
                  hover:border-primary/40
                  hover:bg-primary/[0.05]
                  hover:shadow-2xl
                  hover:shadow-primary/10
                "
              >

                <div className="flex items-start justify-between">

                  <div
                    className="
                      h-12 w-12
                      rounded-xl
                      bg-primary/10
                      border border-primary/20
                      flex items-center justify-center
                    "
                  >
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>

                  <ChevronRight
                    className="
                      h-5 w-5
                      text-muted-foreground
                      transition-transform
                      group-hover:translate-x-1
                    "
                  />

                </div>


                <h4 className="mt-6 text-lg font-semibold">
                  Research Discovery
                </h4>

                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Find research papers personalized to your interests,
                  goals, and research profile.
                </p>


                <div className="mt-5 flex flex-wrap gap-2">

                  <span className="text-[11px] px-2 py-1 rounded-md bg-white/5 text-muted-foreground">
                    Articles
                  </span>

                  <span className="text-[11px] px-2 py-1 rounded-md bg-white/5 text-muted-foreground">
                    Personalized
                  </span>

                </div>

              </div>

            </Link>


            {/* ================================================= */}
            {/* RESEARCH GAP */}
            {/* ================================================= */}

            <Link
              href="/research-gaps"
              className="group"
            >

              <div
                className="
                  h-full
                  rounded-2xl
                  border border-white/10
                  bg-white/[0.03]
                  backdrop-blur-xl
                  p-6
                  transition-all
                  duration-300
                  hover:-translate-y-1
                  hover:border-purple-500/40
                  hover:bg-purple-500/[0.05]
                  hover:shadow-2xl
                  hover:shadow-purple-500/10
                "
              >

                <div className="flex items-start justify-between">

                  <div
                    className="
                      h-12 w-12
                      rounded-xl
                      bg-purple-500/10
                      border border-purple-500/20
                      flex items-center justify-center
                    "
                  >
                    <FileSearch className="h-6 w-6 text-purple-400" />
                  </div>

                  <ChevronRight
                    className="
                      h-5 w-5
                      text-muted-foreground
                      transition-transform
                      group-hover:translate-x-1
                    "
                  />

                </div>


                <h4 className="mt-6 text-lg font-semibold">
                  Research Gap Identification
                </h4>

                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Analyze research literature and uncover unexplored
                  problems, limitations, and opportunities.
                </p>


                <div className="mt-5 flex flex-wrap gap-2">

                  <span className="text-[11px] px-2 py-1 rounded-md bg-white/5 text-muted-foreground">
                    AI Analysis
                  </span>

                  <span className="text-[11px] px-2 py-1 rounded-md bg-white/5 text-muted-foreground">
                    Research Gaps
                  </span>

                </div>

              </div>

            </Link>


            {/* ================================================= */}
            {/* PROJECT IDEATION */}
            {/* ================================================= */}

            <Link
              href="/project-ideas"
              className="group"
            >

              <div
                className="
                  h-full
                  rounded-2xl
                  border border-white/10
                  bg-white/[0.03]
                  backdrop-blur-xl
                  p-6
                  transition-all
                  duration-300
                  hover:-translate-y-1
                  hover:border-yellow-500/40
                  hover:bg-yellow-500/[0.05]
                  hover:shadow-2xl
                  hover:shadow-yellow-500/10
                "
              >

                <div className="flex items-start justify-between">

                  <div
                    className="
                      h-12 w-12
                      rounded-xl
                      bg-yellow-500/10
                      border border-yellow-500/20
                      flex items-center justify-center
                    "
                  >
                    <Lightbulb className="h-6 w-6 text-yellow-400" />
                  </div>

                  <ChevronRight
                    className="
                      h-5 w-5
                      text-muted-foreground
                      transition-transform
                      group-hover:translate-x-1
                    "
                  />

                </div>


                <h4 className="mt-6 text-lg font-semibold">
                  Project Ideation
                </h4>

                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Transform research gaps into practical project ideas
                  personalized to your skills and goals.
                </p>


                <div className="mt-5 flex flex-wrap gap-2">

                  <span className="text-[11px] px-2 py-1 rounded-md bg-white/5 text-muted-foreground">
                    AI Generated
                  </span>

                  <span className="text-[11px] px-2 py-1 rounded-md bg-white/5 text-muted-foreground">
                    Personalized
                  </span>

                </div>

              </div>

            </Link>


            {/* ================================================= */}
            {/* AUTHORS */}
            {/* ================================================= */}

            <Link
              href="/author_topic"
              className="group"
            >

              <div
                className="
                  h-full
                  rounded-2xl
                  border border-white/10
                  bg-white/[0.03]
                  backdrop-blur-xl
                  p-6
                  transition-all
                  duration-300
                  hover:-translate-y-1
                  hover:border-blue-500/40
                  hover:bg-blue-500/[0.05]
                  hover:shadow-2xl
                  hover:shadow-blue-500/10
                "
              >

                <div className="flex items-start justify-between">

                  <div
                    className="
                      h-12 w-12
                      rounded-xl
                      bg-blue-500/10
                      border border-blue-500/20
                      flex items-center justify-center
                    "
                  >
                    <Users className="h-6 w-6 text-blue-400" />
                  </div>

                  <ChevronRight
                    className="
                      h-5 w-5
                      text-muted-foreground
                      transition-transform
                      group-hover:translate-x-1
                    "
                  />

                </div>


                <h4 className="mt-6 text-lg font-semibold">
                  Researcher Discovery
                </h4>

                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Discover researchers and experts based on your
                  research interests and institutional preferences.
                </p>


                <div className="mt-5 flex flex-wrap gap-2">

                  <span className="text-[11px] px-2 py-1 rounded-md bg-white/5 text-muted-foreground">
                    Experts
                  </span>

                  <span className="text-[11px] px-2 py-1 rounded-md bg-white/5 text-muted-foreground">
                    Institutions
                  </span>

                </div>

              </div>

            </Link>


            {/* ================================================= */}
            {/* AUTHOR SIMILARITY */}
            {/* ================================================= */}

            <Link
              href="/author-topic"
              className="group"
            >

              <div
                className="
                  h-full
                  rounded-2xl
                  border border-white/10
                  bg-white/[0.03]
                  backdrop-blur-xl
                  p-6
                  transition-all
                  duration-300
                  hover:-translate-y-1
                  hover:border-cyan-500/40
                  hover:bg-cyan-500/[0.05]
                  hover:shadow-2xl
                  hover:shadow-cyan-500/10
                "
              >

                <div className="flex items-start justify-between">

                  <div
                    className="
                      h-12 w-12
                      rounded-xl
                      bg-cyan-500/10
                      border border-cyan-500/20
                      flex items-center justify-center
                    "
                  >
                    <Network className="h-6 w-6 text-cyan-400" />
                  </div>

                  <ChevronRight
                    className="
                      h-5 w-5
                      text-muted-foreground
                      transition-transform
                      group-hover:translate-x-1
                    "
                  />

                </div>


                <h4 className="mt-6 text-lg font-semibold">
                  Expertise Alignment
                </h4>

                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Find researchers whose expertise aligns with specific
                  research topics and areas.
                </p>


                <div className="mt-5 flex flex-wrap gap-2">

                  <span className="text-[11px] px-2 py-1 rounded-md bg-white/5 text-muted-foreground">
                    Knowledge Graph
                  </span>

                  <span className="text-[11px] px-2 py-1 rounded-md bg-white/5 text-muted-foreground">
                    Matching
                  </span>

                </div>

              </div>

            </Link>


            {/* ================================================= */}
            {/* PROBLEM STATEMENTS */}
            {/* ================================================= */}

            <Link
              href="/problem-statement"
              className="group"
            >

              <div
                className="
                  h-full
                  rounded-2xl
                  border border-white/10
                  bg-white/[0.03]
                  backdrop-blur-xl
                  p-6
                  transition-all
                  duration-300
                  hover:-translate-y-1
                  hover:border-orange-500/40
                  hover:bg-orange-500/[0.05]
                  hover:shadow-2xl
                  hover:shadow-orange-500/10
                "
              >

                <div className="flex items-start justify-between">

                  <div
                    className="
                      h-12 w-12
                      rounded-xl
                      bg-orange-500/10
                      border border-orange-500/20
                      flex items-center justify-center
                    "
                  >
                    <Search className="h-6 w-6 text-orange-400" />
                  </div>

                  <ChevronRight
                    className="
                      h-5 w-5
                      text-muted-foreground
                      transition-transform
                      group-hover:translate-x-1
                    "
                  />

                </div>


                <h4 className="mt-6 text-lg font-semibold">
                  Problem Statement Generator
                </h4>

                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Combine multiple research papers to generate
                  potential research problem statements.
                </p>


                <div className="mt-5 flex flex-wrap gap-2">

                  <span className="text-[11px] px-2 py-1 rounded-md bg-white/5 text-muted-foreground">
                    5 Papers
                  </span>

                  <span className="text-[11px] px-2 py-1 rounded-md bg-white/5 text-muted-foreground">
                    LLM
                  </span>

                </div>

              </div>

            </Link>

          </div>

        </section>


        {/* =================================================== */}
        {/* HOW IT WORKS */}
        {/* =================================================== */}

        <section className="mt-16">

          <div className="mb-6">

            <h3 className="text-xl font-semibold">
              How RESEARCHPILOT Works
            </h3>

            <p className="text-sm text-muted-foreground mt-1">
              From research interest to actionable project direction.
            </p>

          </div>


          <div
            className="
              rounded-2xl
              border border-white/10
              bg-white/[0.02]
              backdrop-blur-xl
              p-6
              md:p-8
            "
          >

            <div
              className="
                grid
                grid-cols-1
                md:grid-cols-4
                gap-8
              "
            >

              {/* STEP 1 */}

              <div>

                <div
                  className="
                    h-9 w-9
                    rounded-lg
                    bg-primary/10
                    border border-primary/20
                    flex items-center justify-center
                    text-sm
                    font-semibold
                    text-primary
                  "
                >
                  01
                </div>

                <h4 className="mt-4 font-semibold">
                  Define Your Goal
                </h4>

                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Tell RESEARCHPILOT about your interests, skills,
                  experience, and research objectives.
                </p>

              </div>


              {/* STEP 2 */}

              <div>

                <div
                  className="
                    h-9 w-9
                    rounded-lg
                    bg-primary/10
                    border border-primary/20
                    flex items-center justify-center
                    text-sm
                    font-semibold
                    text-primary
                  "
                >
                  02
                </div>

                <h4 className="mt-4 font-semibold">
                  Discover Research
                </h4>

                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Explore papers and researchers connected through
                  the academic knowledge graph.
                </p>

              </div>


              {/* STEP 3 */}

              <div>

                <div
                  className="
                    h-9 w-9
                    rounded-lg
                    bg-primary/10
                    border border-primary/20
                    flex items-center justify-center
                    text-sm
                    font-semibold
                    text-primary
                  "
                >
                  03
                </div>

                <h4 className="mt-4 font-semibold">
                  Find Research Gaps
                </h4>

                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Use AI to analyze literature and identify unexplored
                  research opportunities.
                </p>

              </div>


              {/* STEP 4 */}

              <div>

                <div
                  className="
                    h-9 w-9
                    rounded-lg
                    bg-primary/10
                    border border-primary/20
                    flex items-center justify-center
                    text-sm
                    font-semibold
                    text-primary
                  "
                >
                  04
                </div>

                <h4 className="mt-4 font-semibold">
                  Build Your Project
                </h4>

                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Turn identified gaps into project ideas aligned with
                  your skills and research goals.
                </p>

              </div>

            </div>

          </div>

        </section>


        {/* =================================================== */}
        {/* FOOTER */}
        {/* =================================================== */}

        <footer
          className="
            mt-16
            pt-6
            border-t border-white/10
            flex
            flex-col
            sm:flex-row
            items-center
            justify-between
            gap-3
            text-xs
            text-muted-foreground
          "
        >

          <span>
            RESEARCHPILOT
          </span>

          <span>
            AI-Driven Research Discovery & Guidance
          </span>

        </footer>

      </div>

    </main>
  );
}