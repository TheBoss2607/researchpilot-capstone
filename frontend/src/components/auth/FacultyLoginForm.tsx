
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
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';

// ==========================================================
// VALIDATION
// ==========================================================

const facultyLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Please enter a valid institutional email address.'),

  password: z
    .string()
    .min(1, 'Please enter your password.'),
});

type FacultyLoginFormValues = z.infer<
  typeof facultyLoginSchema
>;

// ==========================================================
// PROPS
// ==========================================================

interface FacultyLoginFormProps {
  onSuccess: () => void;
}

// ==========================================================
// CONFIGURATION
// ==========================================================

const API_URL = 'http://localhost:5000';

// ==========================================================
// COMPONENT
// ==========================================================

export function FacultyLoginForm({
  onSuccess,
}: FacultyLoginFormProps) {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FacultyLoginFormValues>({
    resolver: zodResolver(facultyLoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // ==========================================================
  // SUBMIT
  // ==========================================================

  const onSubmit = async (data: FacultyLoginFormValues) => {
    setIsLoading(true);

    const payload = {
      email: data.email.trim().toLowerCase(),
      password: data.password,
    };

    try {
      const response = await fetch(`${API_URL}/faculty/login`, {
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
          title: 'Faculty Login Failed',
          description:
            result.error ||
            result.message ||
            'Invalid institutional email or password.',
          variant: 'destructive',
        });

        return;
      }

      // Ensure the backend confirms that this is a faculty account.
      if (result.role && result.role !== 'faculty') {
        toast({
          title: 'Access Denied',
          description:
            'This account is not registered as a faculty account.',
          variant: 'destructive',
        });

        return;
      }

      // Store convenience information only.
      // The actual authentication state is maintained by Flask.
      localStorage.setItem('userEmail', payload.email);
      localStorage.setItem('userRole', 'faculty');

      if (result.faculty_id) {
        localStorage.setItem('facultyId', result.faculty_id);
      }

      toast({
        title: 'Login Successful!',
        description: 'Welcome back to your faculty dashboard.',
      });

      onSuccess();
    } catch (error) {
      console.error('Faculty login network error:', error);

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
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
              <GraduationCap className="h-5 w-5 text-indigo-600" />
            </div>

            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Faculty Login
              </h3>

              <p className="text-sm text-slate-500">
                Access your ResearchPilot faculty account.
              </p>
            </div>
          </div>

          <p className="text-sm leading-5 text-slate-500">
            Sign in using the institutional email address and
            password associated with your faculty account.
          </p>
        </div>

        {/* EMAIL */}

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
                    autoComplete="username"
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
                    placeholder="Enter your password"
                    autoComplete="current-password"
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

        {/* SECURITY INFORMATION */}

        <div className="flex items-start gap-2.5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />

          <p className="text-xs leading-5 text-slate-600">
            Faculty access is verified against your registered
            institutional account. Only authorized faculty members
            can access the faculty dashboard.
          </p>
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
                Signing in...
              </>
            ) : (
              <>
                Login to Faculty Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
