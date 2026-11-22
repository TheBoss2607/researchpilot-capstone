
'use client';

import { Button } from '@/components/ui/button';
import {
  Github,
  Linkedin,
  Globe,
  MoveRight,
  Database,
  Cpu,
  Activity,
  ArrowDown,
  CheckCircle2,
  BookOpen,
  Lightbulb,
  Search,
  Network,
  LayoutDashboard,
  Compass,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthDialog } from '@/components/auth/AuthDialog';

// ============================================================
// TYPES
// ============================================================

type UserRole = 'student' | 'faculty';

export default function Home() {
  const router = useRouter();

  const [isExiting, setIsExiting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] =
    useState<'login' | 'signup'>('login');

  // ============================================================
  // AUTHENTICATION
  // ============================================================

  const handleAuthClick = (mode: 'login' | 'signup') => {
    setDialogMode(mode);
    setDialogOpen(true);
  };

  // Redirect based on the authenticated account type.
  const handleSuccess = (role: UserRole) => {
    setDialogOpen(false);
    setIsExiting(true);

    const destination =
      role === 'faculty'
        ? '/faculty/dashboard'
        : '/recommendation-type';

    setTimeout(() => {
      router.replace(destination);
    }, 600);
  };

  // ============================================================
  // METHODOLOGY
  // ============================================================

  const methodology = [
    {
      number: '01',
      icon: <Database className="h-6 w-6" />,
      tag: 'KNOWLEDGE FOUNDATION',
      title: 'Knowledge Graph Research Mapping',
      desc: 'Connecting research papers, authors, concepts, and academic domains through a structured knowledge graph to reveal meaningful relationships across research.',
    },
    {
      number: '02',
      icon: <Cpu className="h-6 w-6" />,
      tag: 'PERSONALIZED DISCOVERY',
      title: 'Interest-Aware Research Recommendations',
      desc: 'Combining student interests, research goals, relevance signals, and optimization techniques to prioritize literature aligned with individual research needs.',
    },
    {
      number: '03',
      icon: <Activity className="h-6 w-6" />,
      tag: 'RESEARCH DEVELOPMENT',
      title: 'Algorithmic Gap Analysis & Project Ideation',
      desc: 'Applying structured analysis of research literature to identify potential gaps, formulate problem statements, and derive feasible project directions.',
    },
  ];

  // ============================================================
  // SIX-STAGE RESEARCH PATHWAY
  // ============================================================

  const researchPathway = [
    {
      number: '01',
      label: 'Interests & Goals',
      detail: 'Define your research direction',
      icon: <Compass className="h-5 w-5" />,
    },
    {
      number: '02',
      label: 'Research Discovery',
      detail: 'Explore relevant literature',
      icon: <BookOpen className="h-5 w-5" />,
    },
    {
      number: '03',
      label: 'Research Gap Identification',
      detail: 'Discover potential opportunities',
      icon: <Search className="h-5 w-5" />,
    },
    {
      number: '04',
      label: 'Project Ideation',
      detail: 'Develop actionable project ideas',
      icon: <Lightbulb className="h-5 w-5" />,
    },
    {
      number: '05',
      label: 'Faculty Expertise Alignment',
      detail: 'Find relevant academic expertise',
      icon: <Users className="h-5 w-5" />,
    },
    {
      number: '06',
      label: 'Research Dashboard',
      detail: 'Review your research journey',
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
  ];

  // ============================================================
  // TEAM
  // ============================================================

  const team = [
    {
      name: 'Nandakishore P',
      role: 'Full Stack & Research System Development',
      id: 'PES2UG22CS334',
      linkedin: 'https://www.linkedin.com/in/nandakishore-pramod/',
      portfolio: 'https://google.com',
      github: 'https://github.com/TheBoss2607',
    },
  ];

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <main
      className="
        relative min-h-screen w-full overflow-x-hidden
        bg-[#f7f8fc] text-slate-900
        selection:bg-blue-100 selection:text-blue-900
      "
    >
      {/* ======================================================
          BACKGROUND
      ====================================================== */}

      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="
            absolute left-1/2 top-[-220px]
            h-[650px] w-[850px] -translate-x-1/2
            rounded-full bg-blue-100/60 blur-[120px]
          "
        />

        <div
          className="
            absolute right-[-180px] top-[420px]
            h-[500px] w-[500px]
            rounded-full bg-violet-100/50 blur-[120px]
          "
        />

        <div
          className="
            absolute inset-0 opacity-40
            [background-image:linear-gradient(#d9deea_1px,transparent_1px),linear-gradient(90deg,#d9deea_1px,transparent_1px)]
            [background-size:64px_64px]
            [mask-image:linear-gradient(to_bottom,black,transparent_75%)]
          "
        />
      </div>

      <AnimatePresence>
        {!isExiting && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{
              opacity: 0,
              y: -40,
              filter: 'blur(8px)',
            }}
            transition={{
              duration: 0.6,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative z-10"
          >
            {/* ==================================================
                NAVIGATION
            ================================================== */}

            <nav
              className="
                fixed left-1/2 top-5 z-50
                flex h-[64px] w-[calc(100%-32px)]
                max-w-6xl -translate-x-1/2
                items-center justify-between
                rounded-2xl border border-slate-200/80
                bg-white/90 px-5
                shadow-[0_10px_40px_rgba(15,23,42,0.06)]
                backdrop-blur-xl sm:px-7
              "
            >
              {/* Logo */}

              <div className="flex items-center gap-3">
                <div
                  className="
                    flex h-9 w-9 items-center justify-center
                    rounded-xl bg-blue-600 shadow-sm
                  "
                >
                  <span className="text-sm font-bold tracking-tight text-white">
                    RP
                  </span>
                </div>

                <div className="hidden sm:block">
                  <p className="text-sm font-bold tracking-tight text-slate-900">
                    RESEARCHPILOT
                  </p>
                  <p
                    className="
                      text-[9px] font-medium uppercase
                      tracking-[0.18em] text-slate-400
                    "
                  >
                    Research Guidance
                  </p>
                </div>
              </div>

              {/* Navigation actions */}

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => handleAuthClick('login')}
                  className="
                    rounded-xl px-3 py-2.5 text-xs font-semibold
                    text-slate-600 transition-colors
                    hover:bg-slate-100 hover:text-slate-900
                    sm:px-4
                  "
                >
                  Log In
                </button>

                <button
                  type="button"
                  onClick={() => handleAuthClick('signup')}
                  className="
                    rounded-xl bg-slate-900 px-4 py-2.5
                    text-xs font-semibold text-white shadow-sm
                    transition-all hover:bg-blue-600 hover:shadow-md
                    sm:px-5
                  "
                >
                  Get Started
                </button>
              </div>
            </nav>

            {/* ==================================================
                HERO
            ================================================== */}

            <section
              className="
                relative flex min-h-screen items-center
                justify-center px-6 pb-24 pt-32
              "
            >
              <div className="mx-auto w-full max-w-6xl">
                <div
                  className="
                    grid items-center gap-16
                    lg:grid-cols-[1.1fr_0.9fr] lg:gap-20
                  "
                >
                  {/* LEFT — HERO CONTENT */}

                  <motion.div
                    initial={{ opacity: 0, y: 25 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7 }}
                    className="text-center lg:text-left"
                  >
                    <div
                      className="
                        mb-7 inline-flex items-center gap-2
                        rounded-full border border-blue-200
                        bg-blue-50 px-4 py-2
                        text-[10px] font-bold uppercase
                        tracking-[0.18em] text-blue-600
                      "
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      Personalized Research Guidance
                    </div>

                    <h1
                      className="
                        text-5xl font-bold leading-[1.05]
                        tracking-[-0.045em] text-slate-950
                        sm:text-6xl md:text-7xl lg:text-[5.5rem]
                      "
                    >
                      Turn your
                      <br />
                      <span
                        className="
                          bg-gradient-to-r from-blue-600
                          via-indigo-600 to-violet-600
                          bg-clip-text text-transparent
                        "
                      >
                        interests
                      </span>
                      <br />
                      into research.
                    </h1>

                    <p
                      className="
                        mx-auto mt-7 max-w-2xl
                        text-base leading-7 text-slate-500
                        sm:text-lg lg:mx-0
                      "
                    >
                      RESEARCHPILOT helps students discover relevant
                      literature, identify potential research gaps,
                      formulate problem statements, develop project
                      directions, and explore academic expertise
                      aligned with their interests.
                    </p>

                    {/* CTA */}

                    <div
                      className="
                        mt-9 flex flex-col items-center gap-3
                        sm:flex-row lg:justify-start
                      "
                    >
                      <Button
                        size="lg"
                        onClick={() => handleAuthClick('signup')}
                        className="
                          h-12 rounded-xl bg-slate-900 px-7
                          text-sm font-semibold text-white
                          shadow-lg shadow-slate-900/10
                          transition-all hover:bg-blue-600
                          hover:shadow-blue-600/20
                        "
                      >
                        Get Started
                        <MoveRight className="ml-2 h-4 w-4" />
                      </Button>

                      <button
                        type="button"
                        onClick={() => {
                          document
                            .getElementById('methodology')
                            ?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="
                          flex h-12 items-center gap-2 rounded-xl
                          px-6 text-sm font-semibold text-slate-600
                          transition-colors hover:bg-white
                          hover:text-slate-900
                        "
                      >
                        Explore the system
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Trust points */}

                    <div
                      className="
                        mt-10 flex flex-wrap items-center
                        justify-center gap-x-6 gap-y-3
                        text-xs text-slate-400 lg:justify-start
                      "
                    >
                      {[
                        'Personalized discovery',
                        'Research gap identification',
                        'Project ideation',
                      ].map((item) => (
                        <div key={item} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-blue-500" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* RIGHT — RESEARCH PATHWAY CARD */}

                  <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.15 }}
                    className="relative mx-auto w-full max-w-md"
                  >
                    <div
                      className="
                        absolute -inset-5 rounded-[3rem]
                        border border-blue-100 bg-blue-50/30
                        sm:-inset-8
                      "
                    />

                    <div
                      className="
                        absolute -right-3 -top-4 h-16 w-16
                        rounded-full bg-violet-100 sm:-right-5
                        sm:-top-5 sm:h-20 sm:w-20
                      "
                    />

                    <div
                      className="
                        absolute -bottom-4 -left-3 h-14 w-14
                        rounded-full bg-blue-100 sm:-bottom-5
                        sm:-left-5 sm:h-16 sm:w-16
                      "
                    />

                    <div
                      className="
                        relative overflow-hidden rounded-[2rem]
                        border border-slate-200 bg-white p-5
                        shadow-[0_30px_80px_rgba(15,23,42,0.12)]
                        sm:p-6
                      "
                    >
                      {/* Card top */}

                      <div
                        className="
                          flex items-center justify-between
                          border-b border-slate-100 pb-5
                        "
                      >
                        <div>
                          <p
                            className="
                              text-[10px] font-bold uppercase
                              tracking-[0.18em] text-slate-400
                            "
                          >
                            Your Research Pathway
                          </p>
                          <p className="mt-1 text-lg font-bold text-slate-900">
                            The Research Journey
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            From initial interests to a research workspace
                          </p>
                        </div>

                        <div
                          className="
                            flex h-10 w-10 flex-shrink-0
                            items-center justify-center rounded-xl
                            bg-emerald-50 text-emerald-600
                          "
                        >
                          <Network className="h-5 w-5" />
                        </div>
                      </div>

                      {/* Six-stage pathway */}

                      <div className="relative py-6">
                        <div
                          className="
                            absolute bottom-10 left-[23px] top-10
                            w-px bg-gradient-to-b from-blue-200
                            via-indigo-200 to-violet-200
                          "
                        />

                        <div className="space-y-5">
                          {researchPathway.map((item, index) => (
                            <motion.div
                              key={item.number}
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                duration: 0.35,
                                delay: 0.35 + index * 0.08,
                              }}
                              className="relative flex items-center gap-3"
                            >
                              <div
                                className="
                                  relative z-10 flex h-12 w-12
                                  flex-shrink-0 items-center justify-center
                                  rounded-2xl border border-blue-200
                                  bg-blue-50 text-blue-600
                                  transition-colors
                                "
                              >
                                {item.icon}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p
                                  className="
                                    text-[13px] font-semibold leading-5
                                    text-slate-900 sm:text-sm
                                  "
                                >
                                  {item.number}. {item.label}
                                </p>

                                <p className="mt-0.5 text-xs leading-5 text-slate-400">
                                  {item.detail}
                                </p>
                              </div>

                              {item.number === '06' && (
                                <span
                                  className="
                                    hidden rounded-full border
                                    border-violet-100 bg-violet-50
                                    px-2 py-1 text-[9px] font-bold
                                    uppercase tracking-wide
                                    text-violet-600 sm:inline-flex
                                  "
                                >
                                  Overview
                                </span>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {/* Bottom status */}

                      <div
                        className="
                          rounded-xl border border-blue-100
                          bg-gradient-to-r from-blue-50
                          to-indigo-50/70 px-4 py-3.5
                        "
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="
                              mt-0.5 flex h-7 w-7 flex-shrink-0
                              items-center justify-center rounded-lg
                              bg-white text-blue-600 shadow-sm
                            "
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-blue-800">
                              A connected research workflow
                            </p>
                            <p className="mt-1 text-[11px] leading-5 text-blue-700/80">
                              Each stage helps move your research from
                              exploration toward actionable outcomes.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="relative mt-5 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
                      Discover · Analyze · Develop · Organize
                    </p>
                  </motion.div>
                </div>
              </div>
            </section>

            {/* ==================================================
                METHODOLOGY
            ================================================== */}

            <section
              id="methodology"
              className="border-y border-slate-200 bg-white px-6 py-24 sm:py-28"
            >
              <div className="mx-auto max-w-6xl">
                <div className="mx-auto max-w-3xl text-center">
                  <p
                    className="
                      text-xs font-bold uppercase
                      tracking-[0.22em] text-blue-600
                    "
                  >
                    How RESEARCHPILOT Works
                  </p>

                  <h2
                    className="
                      mt-4 text-4xl font-bold tracking-tight
                      text-slate-950 md:text-5xl
                    "
                  >
                    A structured pathway
                    <br />
                    for research discovery.
                  </h2>

                  <p className="mt-5 text-base leading-7 text-slate-500">
                    Bringing research literature, knowledge relationships,
                    algorithmic analysis, and personalized guidance
                    together in one connected workflow.
                  </p>
                </div>

                {/* Methodology cards */}

                <div className="mt-14 grid gap-5 md:mt-16 md:grid-cols-3">
                  {methodology.map((method, index) => (
                    <motion.div
                      key={method.number}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{
                        duration: 0.5,
                        delay: index * 0.1,
                      }}
                      whileHover={{ y: -5 }}
                      className="
                        group relative overflow-hidden rounded-3xl
                        border border-slate-200 bg-[#fbfcff] p-7
                        shadow-[0_10px_35px_rgba(15,23,42,0.04)]
                        transition-shadow hover:shadow-[0_20px_45px_rgba(15,23,42,0.08)]
                        sm:p-8
                      "
                    >
                      <div
                        className="
                          absolute right-7 top-7 text-xs
                          font-bold text-slate-200
                        "
                      >
                        {method.number}
                      </div>

                      <div
                        className="
                          flex h-12 w-12 items-center justify-center
                          rounded-2xl bg-blue-50 text-blue-600
                          transition-colors group-hover:bg-blue-600
                          group-hover:text-white
                        "
                      >
                        {method.icon}
                      </div>

                      <p
                        className="
                          mt-7 text-[10px] font-bold uppercase
                          tracking-[0.16em] text-blue-600
                        "
                      >
                        {method.tag}
                      </p>

                      <h3 className="mt-3 text-xl font-bold leading-7 text-slate-900">
                        {method.title}
                      </h3>

                      <p className="mt-4 text-sm leading-6 text-slate-500">
                        {method.desc}
                      </p>
                    </motion.div>
                  ))}
                </div>

                {/* Methodology statement */}

                <div
                  className="
                    mt-12 rounded-3xl border border-slate-200
                    bg-slate-50 p-7 text-center md:mt-14 md:p-10
                  "
                >
                  <p className="mx-auto max-w-4xl text-base leading-7 text-slate-600">
                    RESEARCHPILOT combines a knowledge graph,
                    personalized research recommendations, structured
                    research-gap analysis, problem formulation, project
                    ideation, and academic expertise alignment to help
                    students navigate the research process.
                  </p>

                  <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                    {[
                      'Knowledge Graph',
                      'Personalized Recommendations',
                      'Research Discovery',
                      'Gap Identification',
                      'Problem Formulation',
                      'Project Ideation',
                      'Expertise Alignment',
                    ].map((item) => (
                      <span
                        key={item}
                        className="
                          rounded-full border border-slate-200
                          bg-white px-4 py-2 text-xs
                          font-medium text-slate-500
                          transition-colors hover:border-blue-200
                          hover:text-blue-600
                        "
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ==================================================
                TEAM
            ================================================== */}

            <section className="bg-[#f7f8fc] px-6 py-24 sm:py-28">
              <div className="mx-auto max-w-6xl">
                <div className="text-center">
                  <p
                    className="
                      text-xs font-bold uppercase
                      tracking-[0.22em] text-blue-600
                    "
                  >
                    The Team
                  </p>

                  <h2
                    className="
                      mt-4 text-4xl font-bold tracking-tight
                      text-slate-950 md:text-5xl
                    "
                  >
                    Built for research.
                  </h2>

                  <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-500">
                    A student-driven research guidance system
                    developed with academic mentorship at PES University.
                  </p>
                </div>

                {/* Mentor */}

                <div
                  className="
                    mx-auto mt-12 flex max-w-xl flex-col
                    items-center rounded-2xl border border-slate-200
                    bg-white px-6 py-5 text-center shadow-sm
                    sm:flex-row sm:justify-center sm:gap-5 sm:text-left
                  "
                >
                  <div
                    className="
                      flex h-10 w-10 items-center justify-center
                      rounded-xl bg-blue-50 text-blue-600
                    "
                  >
                    <span className="text-sm font-bold">DR</span>
                  </div>

                  <div className="mt-3 sm:mt-0">
                    <p
                      className="
                        text-[10px] font-bold uppercase
                        tracking-[0.16em] text-slate-400
                      "
                    >
                      Academic Mentor
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      Dr. Sudeepa Roy Dey
                    </p>

                    <p className="text-xs text-slate-500">
                      PES University
                    </p>
                  </div>
                </div>

                {/* Team cards */}

                <div className="mt-10 flex justify-center">
                  {team.map((member, index) => (
                    <motion.div
                      key={member.id || index}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5 }}
                      whileHover={{ y: -5 }}
                      className="
                        w-full max-w-md rounded-3xl
                        border border-slate-200 bg-white p-8
                        text-center
                        shadow-[0_12px_40px_rgba(15,23,42,0.05)]
                      "
                    >
                      <div
                        className="
                          mx-auto flex h-24 w-24 items-center
                          justify-center rounded-full border
                          border-blue-100 bg-gradient-to-br
                          from-blue-50 to-violet-50
                          text-2xl font-bold text-blue-600
                        "
                      >
                        NP
                      </div>

                      <h3 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
                        {member.name}
                      </h3>

                      <p
                        className="
                          mt-2 text-xs font-semibold uppercase
                          tracking-[0.12em] text-blue-600
                        "
                      >
                        {member.role}
                      </p>

                      {/* Social links */}

                      <div className="mt-7 flex justify-center gap-3">
                        <a
                          href={member.linkedin}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="LinkedIn profile"
                          className="
                            flex h-10 w-10 items-center justify-center
                            rounded-xl border border-slate-200
                            text-slate-400 transition-all
                            hover:border-blue-200 hover:bg-blue-50
                            hover:text-blue-600
                          "
                        >
                          <Linkedin className="h-4 w-4" />
                        </a>

                        <a
                          href={member.github}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="GitHub profile"
                          className="
                            flex h-10 w-10 items-center justify-center
                            rounded-xl border border-slate-200
                            text-slate-400 transition-all
                            hover:border-blue-200 hover:bg-blue-50
                            hover:text-blue-600
                          "
                        >
                          <Github className="h-4 w-4" />
                        </a>

                        <a
                          href={member.portfolio}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Portfolio website"
                          className="
                            flex h-10 w-10 items-center justify-center
                            rounded-xl border border-slate-200
                            text-slate-400 transition-all
                            hover:border-blue-200 hover:bg-blue-50
                            hover:text-blue-600
                          "
                        >
                          <Globe className="h-4 w-4" />
                        </a>
                      </div>

                      <div className="mt-7 border-t border-slate-100 pt-5">
                        <p
                          className="
                            text-[10px] font-medium uppercase
                            tracking-[0.18em] text-slate-300
                          "
                        >
                          {member.id}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>

            {/* ==================================================
                FINAL CTA
            ================================================== */}

            <section className="px-6 py-20">
              <div
                className="
                  mx-auto max-w-6xl overflow-hidden
                  rounded-[2rem] bg-slate-900 px-7 py-16
                  text-center
                  shadow-[0_30px_80px_rgba(15,23,42,0.15)]
                  sm:px-12
                "
              >
                <div className="mx-auto max-w-2xl">
                  <p
                    className="
                      text-xs font-bold uppercase
                      tracking-[0.2em] text-blue-300
                    "
                  >
                    Begin Your Research Journey
                  </p>

                  <h2 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
                    Your next research direction starts with an idea.
                  </h2>

                  <p className="mt-5 text-sm leading-6 text-slate-400">
                    Explore literature, uncover research opportunities,
                    formulate research problems, and turn your interests
                    into meaningful project directions.
                  </p>

                  <Button
                    size="lg"
                    onClick={() => handleAuthClick('signup')}
                    className="
                      mt-8 h-12 rounded-xl bg-white px-7
                      text-sm font-semibold text-slate-900
                      hover:bg-blue-50
                    "
                  >
                    Get Started
                    <MoveRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </section>

            {/* ==================================================
                FOOTER
            ================================================== */}

            <footer className="border-t border-slate-200 bg-white px-6 py-10">
              <div
                className="
                  mx-auto flex max-w-6xl flex-col
                  items-center justify-between gap-5
                  text-center sm:flex-row sm:text-left
                "
              >
                <div className="flex items-center gap-3">
                  <div
                    className="
                      flex h-8 w-8 items-center justify-center
                      rounded-lg bg-blue-600
                    "
                  >
                    <span className="text-[10px] font-bold text-white">
                      RP
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      RESEARCHPILOT
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Research Discovery & Guidance
                    </p>
                  </div>
                </div>

                <p
                  className="
                    text-[10px] font-medium uppercase
                    tracking-[0.15em] text-slate-400
                  "
                >
                  RESEARCHPILOT // 2026
                </p>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================
          AUTH DIALOG
      ====================================================== */}

      <AuthDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        onModeChange={setDialogMode}
        onSuccess={handleSuccess}
      />
    </main>
  );
}
