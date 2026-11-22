
'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { useToast } from '@/hooks/use-toast';

import {
  Mail,
  LockKeyhole,
  UserRound,
  ShieldCheck,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  IdCard,
} from 'lucide-react';

// ==========================================================
// VALIDATION
// ==========================================================

const facultySignUpSchema = z
  .object({
    facultyId: z
      .string()
      .trim()
      .min(1, 'Please enter your faculty ID.'),

    email: z
      .string()
      .trim()
      .email('Please enter a valid institutional email address.'),

    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long.'),

    confirmPassword: z
      .string()
      .min(1, 'Please confirm your password.'),

    invitationCode: z
      .string()
      .trim()
      .min(1, 'Please enter your faculty verification code.'),
  })
  .refine(
    (data) => data.password === data.confirmPassword,
    {
      message: 'Passwords do not match.',
      path: ['confirmPassword'],
    }
  );

type FacultySignUpFormValues = z.infer<
  typeof facultySignUpSchema
>;

// ==========================================================
// PROPS
// ==========================================================

interface FacultySignUpFormProps {
  onSuccess: () => void;
}

// ==========================================================
// CONFIGURATION
// ==========================================================

const API_URL = 'http://localhost:5000';

// ==========================================================
// COMPONENT
// ==========================================================

export function FacultySignUpForm({
  onSuccess,
}: FacultySignUpFormProps) {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);
  const [showInvitationCode, setShowInvitationCode] =
    useState(false);

  const form = useForm<FacultySignUpFormValues>({
    resolver: zodResolver(facultySignUpSchema),
    defaultValues: {
      facultyId: '',
      email: '',
      password: '',
      confirmPassword: '',
      invitationCode: '',
    },
  });

  // ==========================================================
  // SUBMIT
  // ==========================================================

  const onSubmit = async (data: FacultySignUpFormValues) => {
    setIsLoading(true);

    const payload = {
      faculty_id: data.facultyId.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password,
      invitation_code: data.invitationCode.trim(),
    };

    try {
      const response = await fetch(`${API_URL}/faculty/signup`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast({
          title: 'Faculty Registration Failed',
          description:
            result.error ||
            result.message ||
            'Unable to create your faculty account. Please verify your details.',
          variant: 'destructive',
        });

        return;
      }

      // Store basic client-side convenience information.
      // Authentication and authorization must be enforced
      // by the Flask backend using the session cookie.
      localStorage.setItem('userEmail', payload.email);
      localStorage.setItem('userRole', 'faculty');

      if (result.faculty_id) {
        localStorage.setItem('facultyId', result.faculty_id);
      } else {
        localStorage.setItem('facultyId', payload.faculty_id);
      }

      toast({
        title: 'Faculty Account Created!',
        description:
          'Your faculty account has been registered successfully.',
      });

      onSuccess();
    } catch (error) {
      console.error('Faculty signup network error:', error);

      toast({
        title: 'Connection Error',
        description:
          'Could not connect to the backend server. Make sure Flask is running on port 5000.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================================
  // STYLING
  // ==========================================================

  const inputClass =
    'h-11 rounded-xl border-slate-200 bg-slate-50 pl-10 text-sm focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10';

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5"
      >
        {/* INTRODUCTION */}

        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Faculty account details
          </h3>

          <p className="mt-1 text-sm leading-5 text-slate-500">
            Register using your existing institutional faculty
            profile to access the ResearchPilot faculty dashboard.
          </p>
        </div>

        {/* FACULTY ID */}

        <FormField
          control={form.control}
          name="facultyId"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-sm font-semibold text-slate-700">
                Faculty ID
              </FormLabel>

              <FormControl>
                <div className="relative">
                  <IdCard className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <Input
                    placeholder="Enter your faculty ID"
                    autoComplete="username"
                    {...field}
                    className={inputClass}
                  />
                </div>
              </FormControl>

              <p className="text-xs text-slate-400">
                Use the faculty ID associated with your institutional
                profile.
              </p>

              <FormMessage />
            </FormItem>
          )}
        />

        {/* INSTITUTIONAL EMAIL */}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-sm font-semibold text-slate-700">
                Institutional email
              </FormLabel>

              <FormControl>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <Input
                    type="email"
                    placeholder="you@institution.edu"
                    autoComplete="email"
                    {...field}
                    className={inputClass}
                  />
                </div>
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        {/* PASSWORD */}

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-sm font-semibold text-slate-700">
                Password
              </FormLabel>

              <FormControl>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    {...field}
                    className={`${inputClass} pr-11`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((previous) => !previous)
                    }
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        {/* CONFIRM PASSWORD */}

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-sm font-semibold text-slate-700">
                Confirm password
              </FormLabel>

              <FormControl>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    {...field}
                    className={`${inputClass} pr-11`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(
                        (previous) => !previous
                      )
                    }
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                    aria-label={
                      showConfirmPassword
                        ? 'Hide confirm password'
                        : 'Show confirm password'
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        {/* FACULTY VERIFICATION */}

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
          <div className="mb-3 flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-800">
                Faculty verification
              </h4>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Enter the invitation or authorization code provided
                by your institution to verify your faculty registration.
              </p>
            </div>
          </div>

          <FormField
            control={form.control}
            name="invitationCode"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-sm font-semibold text-slate-700">
                  Faculty verification code
                </FormLabel>

                <FormControl>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <Input
                      type={showInvitationCode ? 'text' : 'password'}
                      placeholder="Enter authorization code"
                      autoComplete="off"
                      {...field}
                      className={`${inputClass} bg-white pr-11`}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowInvitationCode(
                          (previous) => !previous
                        )
                      }
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                      aria-label={
                        showInvitationCode
                          ? 'Hide verification code'
                          : 'Show verification code'
                      }
                    >
                      {showInvitationCode ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* SUBMIT */}

        <div className="pt-1">
          <Button
            type="submit"
            disabled={isLoading}
            className="h-12 w-full rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-lg shadow-indigo-600/15 transition-all hover:bg-indigo-700 hover:shadow-indigo-600/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating faculty account...
              </>
            ) : (
              <>
                Create Faculty Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>

          <p className="mt-3 text-center text-xs leading-5 text-slate-400">
            Your faculty credentials will be linked to your existing
            institutional faculty profile.
          </p>
        </div>
      </form>
    </Form>
  );
}
