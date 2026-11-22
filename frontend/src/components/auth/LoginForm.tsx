
'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { Input } from '@/components/ui/input';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

import {
  ArrowRight,
  Loader2,
  LockKeyhole,
  Mail,
} from 'lucide-react';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address.'),

  password: z
    .string()
    .min(1, 'Password is required.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSuccess: () => void;
}

interface LoginResponse {
  message?: string;
  email?: string;
  role?: string;
  error?: string;
  details?: string;
}

const API_URL = 'http://localhost:5000';

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),

    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    if (isLoading) return;

    setIsLoading(true);

    try {
      const email = data.email.trim().toLowerCase();

      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',

        credentials: 'include',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          email,
          password: data.password,
        }),
      });

      // Safely parse the backend response.
      const responseText = await response.text();

      let result: LoginResponse = {};

      try {
        result = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        console.error(
          'Login returned a non-JSON response:',
          responseText
        );
      }

      // Handle unsuccessful login.
      if (!response.ok) {
        console.error('Login request failed:', {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
          responseBody: responseText,
        });

        const description =
          response.status === 500
            ? 'The backend encountered an error. Check the Flask terminal for details.'
            : result.error || `Login failed (${response.status}).`;

        toast({
          title: 'Login Failed',
          description,
          variant: 'destructive',
        });

        return;
      }

      // The student form must not accept a faculty session.
      // This check will become relevant once the backend
      // returns the authenticated account role.
      if (
        result.role &&
        result.role !== 'student'
      ) {
        toast({
          title: 'Incorrect Account Type',
          description:
            'Please use the Faculty login option to access your faculty account.',
          variant: 'destructive',
        });

        return;
      }

      // Preserve compatibility with existing student pages.
      localStorage.setItem(
        'userEmail',
        result.email || email
      );

      toast({
        title: 'Logged In!',
        description: 'You have successfully logged in.',
      });

      onSuccess();
    } catch (error) {
      console.error('Login request error:', error);

      toast({
        title: 'Login Failed',
        description:
          'Could not connect to Flask. Make sure the backend is running on localhost:5000 and check its CORS configuration.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5"
      >
        {/* EMAIL */}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel
                className="
                  text-sm
                  font-semibold
                  text-slate-700
                "
              >
                Email address
              </FormLabel>

              <FormControl>
                <div className="relative">
                  <Mail
                    className="
                      pointer-events-none
                      absolute
                      left-3.5
                      top-1/2
                      h-4
                      w-4
                      -translate-y-1/2
                      text-slate-400
                    "
                  />

                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...field}
                    className="
                      h-12
                      rounded-xl
                      border-slate-200
                      bg-slate-50
                      pl-10
                      text-slate-900
                      placeholder:text-slate-400
                      transition-all
                      focus:border-indigo-500
                      focus:bg-white
                      focus:ring-4
                      focus:ring-indigo-500/10
                    "
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
            <FormItem>
              <FormLabel
                className="
                  text-sm
                  font-semibold
                  text-slate-700
                "
              >
                Password
              </FormLabel>

              <FormControl>
                <div className="relative">
                  <LockKeyhole
                    className="
                      pointer-events-none
                      absolute
                      left-3.5
                      top-1/2
                      h-4
                      w-4
                      -translate-y-1/2
                      text-slate-400
                    "
                  />

                  <Input
                    type="password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    {...field}
                    className="
                      h-12
                      rounded-xl
                      border-slate-200
                      bg-slate-50
                      pl-10
                      text-slate-900
                      placeholder:text-slate-400
                      transition-all
                      focus:border-indigo-500
                      focus:bg-white
                      focus:ring-4
                      focus:ring-indigo-500/10
                    "
                  />
                </div>
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        {/* SUBMIT */}

        <Button
          type="submit"
          disabled={isLoading}
          className="
            mt-3
            h-12
            w-full
            rounded-xl
            bg-indigo-600
            text-sm
            font-semibold
            text-white
            shadow-lg
            shadow-indigo-600/15
            transition-all
            hover:bg-indigo-700
            hover:shadow-indigo-600/25
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Logging in...
            </>
          ) : (
            <>
              Log In
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
