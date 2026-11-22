'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Loader2,
  LogOut,
  Mail,
  ShieldCheck,
  Trash2,
  User,
  CalendarDays,
  BookOpen,
  X,
} from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API_URL = 'http://127.0.0.1:5000';

// ============================================================
// TYPES
// ============================================================

type LikedWork = {
  id: string;
  title: string;
  summary?: string;
};

type UserProfile = {
  name: string;
  email: string;
  member_since: string;
  account_type: string;
  liked_works?: LikedWork[];
  interests?: string[];
};

// ============================================================
// ACCOUNT VIEW CONTENT
// ============================================================

function AccountViewContent() {
  // ==========================================================
  // STATE
  // ==========================================================

  const [user, setUser] = useState<UserProfile | null>(null);

  const [loading, setLoading] = useState(true);

  const [confirmAction, setConfirmAction] = useState<
    'logout' | 'delete' | 'delete_final' | null
  >(null);

  const [deleteBtnMoveCount, setDeleteBtnMoveCount] = useState(0);

  const [deleteBtnStyle, setDeleteBtnStyle] =
    useState<React.CSSProperties>({});

  const [deletingAccount, setDeletingAccount] = useState(false);

  const router = useRouter();

  const searchParams = useSearchParams();

  const returnTo =
    searchParams.get('returnTo') ||
    '/recommendation-type';

  // ==========================================================
  // LOAD PROFILE
  // ==========================================================

  useEffect(() => {
    const email =
      localStorage.getItem('userEmail') ||
      localStorage.getItem('email');

    if (!email) {
      setLoading(false);
      return;
    }

    fetch(`${API_URL}/get-profile`, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        email,
      }),
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              'Unable to load your profile.'
          );
        }

        return data;
      })
      .then((data) => {
        if (!data.error) {
          setUser(data);
        }

        setLoading(false);
      })
      .catch((error) => {
        console.error(
          'Failed to fetch profile:',
          error
        );

        setLoading(false);
      });
  }, []);

  // ==========================================================
  // RESET DELETE BUTTON
  // ==========================================================

  useEffect(() => {
    if (confirmAction !== 'delete_final') {
      setDeleteBtnMoveCount(0);
      setDeleteBtnStyle({});
    }
  }, [confirmAction]);

  // ==========================================================
  // MOVE DELETE BUTTON
  // ==========================================================

  const moveDeleteButton = () => {
    if (deleteBtnMoveCount < 3) {
      const x = Math.max(
        20,
        Math.random() *
          Math.max(300, window.innerWidth - 220)
      );

      const y = Math.max(
        20,
        Math.random() *
          Math.max(300, window.innerHeight - 120)
      );

      setDeleteBtnStyle({
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        transition: 'all 0.3s ease-out',
        zIndex: 100,
      });

      setDeleteBtnMoveCount(
        (previous) => previous + 1
      );
    }
  };

  // ==========================================================
  // LOGOUT
  // ==========================================================

  
  
  const performLogout = async () => {
    try {
      // Ask Flask to clear its server-side login session.
      // If the endpoint is not implemented yet, browser cleanup
      // will still happen below.
      try {
        await fetch(`${API_URL}/logout`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch (error) {
        console.warn('Backend logout request failed:', error);
      }
    } finally {
      // Remove all session data for this tab.
      sessionStorage.clear();

      // Remove ALL local storage entries, including caches whose
      // names do not start with "researchpilot".
      localStorage.clear();

      // Return to the home page without retaining this page in history.
      setConfirmAction(null);
      router.replace('/');
      router.refresh();
    }
  };



  // ==========================================================
  // DELETE ACCOUNT
  // ==========================================================

  const performDelete = async () => {
    const email =
      localStorage.getItem('userEmail') ||
      localStorage.getItem('email');

    if (!email) {
      return;
    }

    setDeletingAccount(true);

    try {
      const response = await fetch(
        `${API_URL}/delete-account`,
        {
          method: 'DELETE',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            email,
          }),
        }
      );

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => null);

        throw new Error(
          data?.error ||
            'Unable to delete your account.'
        );
      }

      localStorage.removeItem('email');
      localStorage.removeItem('userEmail');

      router.push('/');
    } catch (error) {
      console.error(
        'Failed to delete account:',
        error
      );

      setDeletingAccount(false);
      setConfirmAction(null);

      alert(
        error instanceof Error
          ? error.message
          : 'Unable to delete your account.'
      );
    }
  };

  // ==========================================================
  // CLOSE MODAL
  // ==========================================================

  const closeModal = () => {
    if (deletingAccount) {
      return;
    }

    setConfirmAction(null);
  };

  // ==========================================================
  // LOADING STATE
  // ==========================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8fafc] text-slate-900">

        {/* Header */}

        <header className="border-b border-slate-200 bg-white">

          <div
            className="
              mx-auto
              flex
              h-20
              w-full
              max-w-6xl
              items-center
              justify-between
              px-6
              md:px-8
            "
          >

            <Link
              href={returnTo}
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

            <div className="text-right">

              <p className="text-lg font-semibold tracking-tight text-slate-900">
                RESEARCHPILOT
              </p>

              <p className="text-xs text-slate-400">
                Account
              </p>

            </div>

          </div>

        </header>

        {/* Loading */}

        <section
          className="
            flex
            min-h-[calc(100vh-80px)]
            items-center
            justify-center
            px-6
          "
        >

          <div className="text-center">

            <div
              className="
                mx-auto
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-xl
                bg-slate-100
              "
            >
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            </div>

            <p className="mt-4 text-sm text-slate-500">
              Loading your profile...
            </p>

          </div>

        </section>

      </main>
    );
  }

  // ==========================================================
  // DERIVED DATA
  // ==========================================================

  const likedWorks = user?.liked_works || [];

  const interests = user?.interests || [];

  // ==========================================================
  // MAIN RENDER
  // ==========================================================

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900">

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
            max-w-6xl
            items-center
            justify-between
            px-6
            md:px-8
          "
        >

          {/* Left */}

          <Link
            href={returnTo}
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              px-2
              py-2
              text-sm
              font-medium
              text-slate-500
              transition-colors
              hover:bg-slate-50
              hover:text-slate-900
            "
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          {/* Logo */}

          <Link
            href="/recommendation-type"
            className="text-center"
          >

            <p className="text-lg font-semibold tracking-tight text-slate-900">
              RESEARCHPILOT
            </p>

            <p className="text-[11px] text-slate-400">
              Research discovery & guidance
            </p>

          </Link>

          {/* Right */}

          <div
            className="
              hidden
              items-center
              gap-2
              rounded-lg
              border
              border-slate-200
              bg-slate-50
              px-3
              py-2
              sm:flex
            "
          >

            <ShieldCheck className="h-4 w-4 text-slate-500" />

            <span className="text-xs font-medium text-slate-500">
              Account
            </span>

          </div>

        </div>

      </header>

      {/* ====================================================== */}
      {/* MAIN CONTENT */}
      {/* ====================================================== */}

      <section
        className="
          mx-auto
          w-full
          max-w-6xl
          px-6
          py-12
          md:px-8
          md:py-16
        "
      >

        {/* ==================================================== */}
        {/* PAGE INTRO */}
        {/* ==================================================== */}

        <div className="mb-10">

          <div
            className="
              mb-4
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
            <User className="h-5 w-5" />
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            ACCOUNT
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
            Your research profile
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">
            Manage your account information and review
            the research papers you have saved.
          </p>

        </div>

        {/* ==================================================== */}
        {/* PROFILE GRID */}
        {/* ==================================================== */}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* ================================================== */}
          {/* PROFILE CARD */}
          {/* ================================================== */}

          <div
            className="
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-sm
              lg:col-span-2
            "
          >

            <div className="p-6 md:p-7">

              {/* Profile header */}

              <div
                className="
                  flex
                  flex-col
                  gap-5
                  sm:flex-row
                  sm:items-center
                  sm:justify-between
                "
              >

                <div className="flex items-center gap-4">

                  <div
                    className="
                      flex
                      h-14
                      w-14
                      shrink-0
                      items-center
                      justify-center
                      rounded-2xl
                      bg-slate-900
                      text-white
                    "
                  >
                    <User className="h-6 w-6" />
                  </div>

                  <div className="min-w-0">

                    <h2 className="truncate text-xl font-semibold text-slate-900">
                      {user?.name || 'Guest User'}
                    </h2>

                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">

                      <Mail className="h-3.5 w-3.5" />

                      <span className="truncate">
                        {user?.email ||
                          'guest@example.com'}
                      </span>

                    </div>

                  </div>

                </div>

                <div
                  className="
                    inline-flex
                    w-fit
                    items-center
                    gap-2
                    rounded-full
                    border
                    border-slate-200
                    bg-slate-50
                    px-3
                    py-1.5
                  "
                >

                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

                  <span className="text-xs font-medium text-slate-600">
                    Active account
                  </span>

                </div>

              </div>

              {/* Divider */}

              <div className="my-7 border-t border-slate-100" />

              {/* Account information */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <div
                  className="
                    rounded-xl
                    border
                    border-slate-100
                    bg-slate-50/70
                    p-4
                  "
                >

                  <div className="flex items-center gap-2">

                    <CalendarDays className="h-4 w-4 text-slate-400" />

                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Member since
                    </span>

                  </div>

                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {user?.member_since || 'N/A'}
                  </p>

                </div>

                <div
                  className="
                    rounded-xl
                    border
                    border-slate-100
                    bg-slate-50/70
                    p-4
                  "
                >

                  <div className="flex items-center gap-2">

                    <ShieldCheck className="h-4 w-4 text-slate-400" />

                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Account type
                    </span>

                  </div>

                  <p className="mt-2 text-sm font-medium capitalize text-slate-700">
                    {user?.account_type || 'Researcher'}
                  </p>

                </div>

              </div>

            </div>

          </div>

          {/* ================================================== */}
          {/* RESEARCH SUMMARY */}
          {/* ================================================== */}

          <div
            className="
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-sm
            "
          >

            <div className="p-6 md:p-7">

              <div className="flex items-center gap-3">

                <div
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                    bg-slate-100
                    text-slate-700
                  "
                >
                  <BookOpen className="h-5 w-5" />
                </div>

                <div>

                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Research activity
                  </p>

                  <h2 className="mt-0.5 text-lg font-semibold text-slate-900">
                    Your library
                  </h2>

                </div>

              </div>

              <div className="mt-7">

                <p className="text-3xl font-semibold tracking-tight text-slate-900">
                  {likedWorks.length}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {likedWorks.length === 1
                    ? 'liked research paper'
                    : 'liked research papers'}
                </p>

              </div>

              {interests.length > 0 && (

                <div className="mt-6">

                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Research interests
                  </p>

                  <div className="flex flex-wrap gap-1.5">

                    {interests
                      .slice(0, 4)
                      .map((interest) => (

                        <span
                          key={interest}
                          className="
                            rounded-full
                            border
                            border-slate-200
                            bg-slate-50
                            px-2.5
                            py-1
                            text-xs
                            text-slate-600
                          "
                        >
                          {interest}
                        </span>

                      ))}

                    {interests.length > 4 && (

                      <span
                        className="
                          rounded-full
                          border
                          border-slate-200
                          bg-white
                          px-2.5
                          py-1
                          text-xs
                          text-slate-400
                        "
                      >
                        +{interests.length - 4} more
                      </span>

                    )}

                  </div>

                </div>

              )}

            </div>

          </div>

        </div>

        {/* ==================================================== */}
        {/* LIKED PAPERS */}
        {/* ==================================================== */}

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

          {/* Section header */}

          <div
            className="
              flex
              flex-col
              gap-3
              border-b
              border-slate-100
              px-6
              py-5
              sm:flex-row
              sm:items-center
              sm:justify-between
              md:px-7
            "
          >

            <div className="flex items-center gap-3">

              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  bg-slate-100
                  text-slate-700
                "
              >
                <FileText className="h-5 w-5" />
              </div>

              <div>

                <h2 className="text-lg font-semibold text-slate-900">
                  Liked papers
                </h2>

                <p className="mt-0.5 text-sm text-slate-500">
                  Research papers you have saved for later.
                </p>

              </div>

            </div>

            <div
              className="
                w-fit
                rounded-full
                bg-slate-100
                px-3
                py-1.5
                text-xs
                font-medium
                text-slate-600
              "
            >
              {likedWorks.length}{' '}
              {likedWorks.length === 1
                ? 'paper'
                : 'papers'}
            </div>

          </div>

          {/* Paper list */}

          {likedWorks.length > 0 ? (

            <div className="divide-y divide-slate-100">

              {likedWorks.map((work, index) => (

                <div
                  key={`${work.id}-${index}`}
                  className="
                    p-6
                    transition-colors
                    hover:bg-slate-50/70
                    md:px-7
                  "
                >

                  <a
                    href={`https://openalex.org/works/${work.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >

                    <div
                      className="
                        flex
                        items-start
                        justify-between
                        gap-5
                      "
                    >

                      <div className="min-w-0">

                        <h3
                          className="
                            flex
                            items-start
                            gap-2
                            text-sm
                            font-semibold
                            leading-6
                            text-slate-800
                            transition-colors
                            group-hover:text-slate-950
                          "
                        >

                          <span>
                            {work.title}
                          </span>

                          <ExternalLink
                            className="
                              mt-1
                              h-3.5
                              w-3.5
                              shrink-0
                              text-slate-400
                              transition-colors
                              group-hover:text-slate-700
                            "
                          />

                        </h3>

                        <p
                          className="
                            mt-2
                            line-clamp-3
                            text-sm
                            leading-6
                            text-slate-500
                          "
                        >
                          {work.summary ||
                            'No abstract available for this paper.'}
                        </p>

                      </div>

                    </div>

                  </a>

                </div>

              ))}

            </div>

          ) : (

            <div className="px-6 py-14 text-center md:px-7">

              <div
                className="
                  mx-auto
                  flex
                  h-12
                  w-12
                  items-center
                  justify-center
                  rounded-xl
                  bg-slate-100
                  text-slate-400
                "
              >
                <FileText className="h-5 w-5" />
              </div>

              <h3 className="mt-4 text-sm font-semibold text-slate-700">
                No liked papers yet
              </h3>

              <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-slate-400">
                Papers you like during research discovery
                will appear here for easy access later.
              </p>

              <Link
                href="/recommendation-type"
                className="
                  mt-5
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
                  transition-colors
                  hover:bg-slate-800
                "
              >
                Explore research
              </Link>

            </div>

          )}

        </section>

        {/* ==================================================== */}
        {/* ACCOUNT ACTIONS */}
        {/* ==================================================== */}

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

          <div className="p-6 md:p-7">

            <div className="mb-5">

              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Account management
              </p>

              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                Account actions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Manage your current session or permanently
                remove your account.
              </p>

            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

              {/* Logout */}

              <button
                type="button"
                onClick={() =>
                  setConfirmAction('logout')
                }
                className="
                  inline-flex
                  h-11
                  items-center
                  justify-center
                  gap-2
                  rounded-lg
                  border
                  border-slate-200
                  bg-white
                  px-4
                  text-sm
                  font-medium
                  text-slate-700
                  transition-all
                  hover:border-slate-300
                  hover:bg-slate-50
                  hover:text-slate-900
                "
              >

                <LogOut className="h-4 w-4" />

                Log out

              </button>

              {/* Delete */}

              <button
                type="button"
                onClick={() =>
                  setConfirmAction('delete')
                }
                className="
                  inline-flex
                  h-11
                  items-center
                  justify-center
                  gap-2
                  rounded-lg
                  border
                  border-red-200
                  bg-red-50
                  px-4
                  text-sm
                  font-medium
                  text-red-600
                  transition-all
                  hover:border-red-300
                  hover:bg-red-100
                "
              >

                <Trash2 className="h-4 w-4" />

                Delete account

              </button>

            </div>

          </div>

        </section>

        {/* ==================================================== */}
        {/* FOOTER NOTE */}
        {/* ==================================================== */}

        <p className="mt-8 text-center text-xs text-slate-400">
          Your account information is used to personalize
          your research discovery experience.
        </p>

      </section>

      {/* ====================================================== */}
      {/* LOGOUT MODAL */}
      {/* ====================================================== */}

      {confirmAction === 'logout' && (

        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-slate-950/40
            p-4
            backdrop-blur-sm
          "
        >

          <div
            className="
              relative
              w-full
              max-w-md
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-6
              shadow-2xl
            "
          >

            <button
              type="button"
              onClick={closeModal}
              className="
                absolute
                right-4
                top-4
                flex
                h-8
                w-8
                items-center
                justify-center
                rounded-lg
                text-slate-400
                transition-colors
                hover:bg-slate-100
                hover:text-slate-700
              "
            >
              <X className="h-4 w-4" />
            </button>

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-slate-100
                text-slate-700
              "
            >
              <LogOut className="h-5 w-5" />
            </div>

            <h3 className="mt-5 text-xl font-semibold text-slate-900">
              Log out?
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              You will be signed out of your RESEARCHPILOT
              account on this device.
            </p>

            <div className="mt-7 flex justify-end gap-3">

              <button
                type="button"
                onClick={closeModal}
                className="
                  rounded-lg
                  border
                  border-slate-200
                  bg-white
                  px-4
                  py-2.5
                  text-sm
                  font-medium
                  text-slate-600
                  transition-colors
                  hover:bg-slate-50
                "
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={performLogout}
                className="
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
                  transition-colors
                  hover:bg-slate-800
                "
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>

            </div>

          </div>

        </div>

      )}

      {/* ====================================================== */}
      {/* DELETE MODAL — STEP 1 */}
      {/* ====================================================== */}

      {confirmAction === 'delete' && (

        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-slate-950/40
            p-4
            backdrop-blur-sm
          "
        >

          <div
            className="
              relative
              w-full
              max-w-md
              rounded-2xl
              border
              border-red-100
              bg-white
              p-6
              shadow-2xl
            "
          >

            <button
              type="button"
              onClick={closeModal}
              className="
                absolute
                right-4
                top-4
                flex
                h-8
                w-8
                items-center
                justify-center
                rounded-lg
                text-slate-400
                transition-colors
                hover:bg-slate-100
                hover:text-slate-700
              "
            >
              <X className="h-4 w-4" />
            </button>

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-red-50
                text-red-600
              "
            >
              <Trash2 className="h-5 w-5" />
            </div>

            <h3 className="mt-5 text-xl font-semibold text-slate-900">
              Delete your account?
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              This will permanently remove your account
              and its associated data. This action cannot
              be undone.
            </p>

            <div
              className="
                mt-5
                rounded-xl
                border
                border-red-100
                bg-red-50/60
                px-4
                py-3
              "
            >

              <p className="text-xs leading-5 text-red-600">
                Your profile, saved papers, and account
                information will no longer be available.
              </p>

            </div>

            <div className="mt-7 flex justify-end gap-3">

              <button
                type="button"
                onClick={closeModal}
                className="
                  rounded-lg
                  border
                  border-slate-200
                  bg-white
                  px-4
                  py-2.5
                  text-sm
                  font-medium
                  text-slate-600
                  transition-colors
                  hover:bg-slate-50
                "
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  setConfirmAction('delete_final')
                }
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-lg
                  bg-red-600
                  px-4
                  py-2.5
                  text-sm
                  font-medium
                  text-white
                  transition-colors
                  hover:bg-red-700
                "
              >
                Continue
              </button>

            </div>

          </div>

        </div>

      )}

      {/* ====================================================== */}
      {/* DELETE MODAL — FINAL */}
      {/* ====================================================== */}

      {confirmAction === 'delete_final' && (

        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-slate-950/50
            p-4
            backdrop-blur-sm
          "
        >

          <div
            className="
              relative
              w-full
              max-w-md
              rounded-2xl
              border
              border-red-200
              bg-white
              p-6
              shadow-2xl
            "
          >

            <button
              type="button"
              onClick={closeModal}
              disabled={deletingAccount}
              className="
                absolute
                right-4
                top-4
                flex
                h-8
                w-8
                items-center
                justify-center
                rounded-lg
                text-slate-400
                transition-colors
                hover:bg-slate-100
                hover:text-slate-700
                disabled:opacity-50
              "
            >
              <X className="h-4 w-4" />
            </button>

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-red-50
                text-red-600
              "
            >
              <Trash2 className="h-5 w-5" />
            </div>

            <h3 className="mt-5 text-xl font-semibold text-slate-900">
              Final confirmation
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              This is your final confirmation. If you
              proceed, your RESEARCHPILOT account will be
              permanently deleted.
            </p>

            <div
              className="
                mt-5
                rounded-xl
                border
                border-red-100
                bg-red-50
                p-4
              "
            >

              <p className="text-sm font-medium text-red-700">
                This action cannot be undone.
              </p>

              <p className="mt-1 text-xs leading-5 text-red-600/80">
                Your saved papers, profile information,
                and account data will be removed.
              </p>

            </div>

            <div className="mt-7 flex justify-end gap-3">

              <button
                type="button"
                onClick={closeModal}
                disabled={deletingAccount}
                className="
                  rounded-lg
                  border
                  border-slate-200
                  bg-white
                  px-4
                  py-2.5
                  text-sm
                  font-medium
                  text-slate-600
                  transition-colors
                  hover:bg-slate-50
                  disabled:opacity-50
                "
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={(event) => {
                  if (deletingAccount) {
                    return;
                  }

                  if (deleteBtnMoveCount < 3) {
                    event.preventDefault();
                    moveDeleteButton();
                  } else {
                    performDelete();
                  }
                }}
                onMouseEnter={() => {
                  if (!deletingAccount) {
                    moveDeleteButton();
                  }
                }}
                disabled={deletingAccount}
                style={deleteBtnStyle}
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-lg
                  bg-red-600
                  px-4
                  py-2.5
                  text-sm
                  font-medium
                  text-white
                  shadow-sm
                  transition-colors
                  hover:bg-red-700
                  disabled:cursor-not-allowed
                  disabled:opacity-70
                "
              >

                {deletingAccount ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete forever
                  </>
                )}

              </button>

            </div>

          </div>

        </div>

      )}

    </main>
  );
}

// ============================================================
// PAGE WRAPPER
// ============================================================

export default function AccountViewPage() {
  return (
    <Suspense
      fallback={
        <div
          className="
            flex
            min-h-screen
            items-center
            justify-center
            bg-[#f8fafc]
            text-slate-900
          "
        >
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      }
    >
      <AccountViewContent />
    </Suspense>
  );
}