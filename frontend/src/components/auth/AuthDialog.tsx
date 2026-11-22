
'use client';

import { useEffect, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

import { LoginForm } from './LoginForm';
import { SignUpForm } from './SignUpForm';
import { FacultyLoginForm } from './FacultyLoginForm';
import { FacultySignUpForm } from './FacultySignUpForm';

import {
  GraduationCap,
  BriefcaseBusiness,
  ArrowLeft,
  BookOpen,
} from 'lucide-react';

type UserRole = 'student' | 'faculty';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'login' | 'signup';
  onModeChange: (mode: 'login' | 'signup') => void;
  onSuccess: (role: UserRole) => void;
}

export function AuthDialog({
  open,
  onOpenChange,
  mode,
  onModeChange,
  onSuccess,
}: AuthDialogProps) {
  const [selectedRole, setSelectedRole] =
    useState<UserRole | null>(null);

  const isLogin = mode === 'login';

  // Reset role selection when the dialog closes.
  useEffect(() => {
    if (!open) {
      setSelectedRole(null);
    }
  }, [open]);

  // Reset role selection when switching login/signup.
  useEffect(() => {
    setSelectedRole(null);
  }, [mode]);

  const handleBack = () => {
    setSelectedRole(null);
  };

  const handleModeChange = (nextMode: 'login' | 'signup') => {
    setSelectedRole(null);
    onModeChange(nextMode);
  };

  const handleSuccess = (role: UserRole) => {
    setSelectedRole(null);
    onSuccess(role);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[calc(100vw-2rem)]
          max-w-[760px]
          sm:max-w-[760px]
          max-h-[92dvh]
          overflow-hidden
          rounded-3xl
          border border-slate-200
          bg-white
          p-0
          shadow-2xl
          flex
          flex-col
        "
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {isLogin
              ? 'Log In to ResearchPilot'
              : 'Create your ResearchPilot account'}
          </DialogTitle>

          <DialogDescription>
            Choose your account type to continue.
          </DialogDescription>
        </DialogHeader>

        <div
          className="
            min-h-0
            overflow-y-auto
            overscroll-contain
            p-6
            sm:p-8
            md:p-10
          "
        >
          {/* HEADER */}

          <div className="mb-7 text-center sm:mb-8">
            <div
              className="
                mx-auto
                mb-4
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-2xl
                bg-indigo-50
              "
            >
              <BookOpen className="h-6 w-6 text-indigo-600" />
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {!selectedRole
                ? isLogin
                  ? 'Welcome to ResearchPilot'
                  : 'Get started with ResearchPilot'
                : selectedRole === 'student'
                  ? isLogin
                    ? 'Student Login'
                    : 'Student Registration'
                  : isLogin
                    ? 'Faculty Login'
                    : 'Faculty Registration'}
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500 sm:text-base">
              {!selectedRole
                ? 'Choose the account type that describes you.'
                : selectedRole === 'student'
                  ? isLogin
                    ? 'Sign in to continue your personalized research journey.'
                    : 'Create your student research profile.'
                  : isLogin
                    ? 'Sign in to access your faculty dashboard.'
                    : 'Register using your authorized faculty details.'}
            </p>
          </div>

          {/* ROLE SELECTION */}

          {!selectedRole ? (
            <div className="space-y-4">
              {/* STUDENT OPTION */}

              <button
                type="button"
                onClick={() => setSelectedRole('student')}
                className="
                  group
                  flex
                  w-full
                  items-center
                  gap-4
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  p-5
                  text-left
                  transition-all
                  hover:border-indigo-400
                  hover:bg-indigo-50/50
                  hover:shadow-md
                "
              >
                <div
                  className="
                    flex
                    h-14
                    w-14
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    bg-indigo-50
                    text-indigo-600
                    transition-colors
                    group-hover:bg-indigo-100
                  "
                >
                  <GraduationCap className="h-7 w-7" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-slate-900">
                    Student / Researcher
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    Discover research papers, identify research gaps,
                    generate project ideas and explore research opportunities.
                  </p>
                </div>

                <span className="text-xl text-slate-300 transition-colors group-hover:text-indigo-600">
                  →
                </span>
              </button>

              {/* FACULTY OPTION */}

              <button
                type="button"
                onClick={() => setSelectedRole('faculty')}
                className="
                  group
                  flex
                  w-full
                  items-center
                  gap-4
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  p-5
                  text-left
                  transition-all
                  hover:border-indigo-400
                  hover:bg-indigo-50/50
                  hover:shadow-md
                "
              >
                <div
                  className="
                    flex
                    h-14
                    w-14
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    bg-violet-50
                    text-violet-600
                    transition-colors
                    group-hover:bg-violet-100
                  "
                >
                  <BriefcaseBusiness className="h-7 w-7" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-slate-900">
                    Faculty
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    Access your faculty dashboard and view your
                    institutional research profile.
                  </p>
                </div>

                <span className="text-xl text-slate-300 transition-colors group-hover:text-indigo-600">
                  →
                </span>
              </button>
            </div>
          ) : (
            <>
              {/* BACK BUTTON */}

              <button
                type="button"
                onClick={handleBack}
                className="
                  mb-5
                  inline-flex
                  items-center
                  gap-2
                  text-sm
                  font-medium
                  text-slate-500
                  transition-colors
                  hover:text-indigo-600
                "
              >
                <ArrowLeft className="h-4 w-4" />
                Change account type
              </button>

              {/* STUDENT FORMS */}

              {selectedRole === 'student' && (
                isLogin ? (
                  <LoginForm
                    onSuccess={() => handleSuccess('student')}
                  />
                ) : (
                  <SignUpForm
                    onSuccess={() => handleSuccess('student')}
                  />
                )
              )}

              {/* FACULTY FORMS */}

              {selectedRole === 'faculty' && (
                isLogin ? (
                  <FacultyLoginForm
                    onSuccess={() => handleSuccess('faculty')}
                  />
                ) : (
                  <FacultySignUpForm
                    onSuccess={() => handleSuccess('faculty')}
                  />
                )
              )}
            </>
          )}

          {/* LOGIN / SIGNUP SWITCH */}

          {!selectedRole && (
            <div
              className="
                mt-7
                border-t
                border-slate-100
                pt-5
                text-center
                text-sm
                text-slate-500
                sm:mt-8
                sm:pt-6
              "
            >
              {isLogin
                ? "Don't have an account?"
                : 'Already have an account?'}

              <button
                type="button"
                onClick={() =>
                  handleModeChange(isLogin ? 'signup' : 'login')
                }
                className="
                  ml-1
                  font-medium
                  text-indigo-600
                  transition-colors
                  hover:text-indigo-800
                  hover:underline
                "
              >
                {isLogin ? 'Sign up' : 'Log in'}
              </button>
            </div>
          )}

          {selectedRole && (
            <div
              className="
                mt-7
                border-t
                border-slate-100
                pt-5
                text-center
                text-sm
                text-slate-500
                sm:mt-8
                sm:pt-6
              "
            >
              {isLogin
                ? "Don't have an account?"
                : 'Already have an account?'}

              <button
                type="button"
                onClick={() =>
                  handleModeChange(isLogin ? 'signup' : 'login')
                }
                className="
                  ml-1
                  font-medium
                  text-indigo-600
                  transition-colors
                  hover:text-indigo-800
                  hover:underline
                "
              >
                {isLogin ? 'Sign up' : 'Log in'}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
