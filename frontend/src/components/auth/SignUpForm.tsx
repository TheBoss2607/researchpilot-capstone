
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

import { useState, type KeyboardEvent } from 'react';

import { useToast } from '@/hooks/use-toast';

import {
  X,
  Loader2,
  Mail,
  LockKeyhole,
  Target,
  BarChart3,
  Code2,
  ArrowRight,
} from 'lucide-react';

import { Badge } from '../ui/badge';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const signUpSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address.'),

  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.'),

  topics: z
    .array(z.string())
    .min(1, 'Please add at least one research interest.'),

  researchGoal: z
    .string()
    .min(1, 'Please select your research goal.'),

  experienceLevel: z
    .string()
    .min(1, 'Please select your research experience level.'),

  skills: z
    .array(z.string())
    .default([]),
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

interface SignUpFormProps {
  onSuccess: () => void;
}

const API_URL = 'http://127.0.0.1:5000';

const SUGGESTED_INTERESTS = [
  'Machine Learning',
  'Artificial Intelligence',
  'Data Science',
  'Natural Language Processing',
  'Computer Vision',
  'Cybersecurity',
  'Knowledge Graphs',
  'Software Engineering',
  'Cloud Computing',
  'Robotics',
];

const SUGGESTED_SKILLS = [
  'Python',
  'Java',
  'C++',
  'SQL',
  'JavaScript',
  'React',
  'Flask',
  'TensorFlow',
  'PyTorch',
  'Neo4j',
  'Git',
];

export function SignUpForm({ onSuccess }: SignUpFormProps) {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [topicInput, setTopicInput] = useState('');
  const [skillInput, setSkillInput] = useState('');

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: '',
      password: '',
      topics: [],
      researchGoal: '',
      experienceLevel: '',
      skills: [],
    },
  });

  const topics = form.watch('topics') || [];
  const skills = form.watch('skills') || [];

  // ==========================================================
  // TOPICS
  // ==========================================================

  const addTopic = (value: string) => {
    const trimmedTopic = value.trim();

    if (!trimmedTopic) return;

    const currentTopics = form.getValues('topics') || [];

    const alreadyExists = currentTopics.some(
      (topic) => topic.toLowerCase() === trimmedTopic.toLowerCase()
    );

    if (!alreadyExists) {
      form.setValue('topics', [...currentTopics, trimmedTopic], {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  const handleAddTopic = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;

    e.preventDefault();
    addTopic(topicInput);
    setTopicInput('');
  };

  const handleRemoveTopic = (topicToRemove: string) => {
    const currentTopics = form.getValues('topics') || [];

    form.setValue(
      'topics',
      currentTopics.filter((topic) => topic !== topicToRemove),
      {
        shouldValidate: true,
        shouldDirty: true,
      }
    );
  };

  // ==========================================================
  // SKILLS
  // ==========================================================

  const addSkill = (value: string) => {
    const trimmedSkill = value.trim();

    if (!trimmedSkill) return;

    const currentSkills = form.getValues('skills') || [];

    const alreadyExists = currentSkills.some(
      (skill) => skill.toLowerCase() === trimmedSkill.toLowerCase()
    );

    if (!alreadyExists) {
      form.setValue('skills', [...currentSkills, trimmedSkill], {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  const handleAddSkill = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;

    e.preventDefault();
    addSkill(skillInput);
    setSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const currentSkills = form.getValues('skills') || [];

    form.setValue(
      'skills',
      currentSkills.filter((skill) => skill !== skillToRemove),
      {
        shouldValidate: true,
        shouldDirty: true,
      }
    );
  };

  // ==========================================================
  // SUBMIT
  // ==========================================================

  const onSubmit = async (data: SignUpFormValues) => {
    if (!data.topics || data.topics.length === 0) {
      form.setError('topics', {
        type: 'manual',
        message: 'Please add at least one research interest.',
      });

      return;
    }

    setIsLoading(true);

    const payload = {
      email: data.email.trim().toLowerCase(),
      password: data.password,
      interests: data.topics,
      research_goal: data.researchGoal,
      experience_level: data.experienceLevel,
      skills: data.skills || [],
    };

    try {
      const response = await fetch(`${API_URL}/signup`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        localStorage.setItem('userEmail', payload.email);

        toast({
          title: 'Account Created!',
          description: 'You have successfully signed up.',
        });

        onSuccess();
        return;
      }

      toast({
        title: 'Signup Failed',
        description:
          result.error ||
          result.message ||
          'An error occurred while creating your account.',
        variant: 'destructive',
      });
    } catch (error) {
      console.error('Signup network error:', error);

      toast({
        title: 'Signup Failed',
        description:
          'Could not connect to the backend server. Make sure Flask is running on port 5000.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const suggestionClass =
    'rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700';

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
      >
        {/* ACCOUNT INFORMATION */}

        <div>
          <div className="mb-3">
            <h3 className="text-base font-semibold text-slate-900">
              Account details
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Create your ResearchPilot account.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm font-semibold text-slate-700">
                    Email address
                  </FormLabel>

                  <FormControl>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        {...field}
                        className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10 text-sm focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                      />
                    </div>
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

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
                        type="password"
                        placeholder="At least 8 characters"
                        {...field}
                        className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10 text-sm focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                      />
                    </div>
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* RESEARCH PROFILE */}

        <div className="border-t border-slate-100 pt-4">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-slate-900">
              Research profile
            </h3>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Personalize your research recommendations.
            </p>
          </div>

          {/* GOAL AND EXPERIENCE */}

          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="researchGoal"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm font-semibold text-slate-700">
                    Research goal
                  </FormLabel>

                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10">
                        <Target className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                        <SelectValue placeholder="Choose your goal" />
                      </SelectTrigger>
                    </FormControl>

                    <SelectContent>
                      <SelectItem value="find_topic">
                        Find a research topic
                      </SelectItem>
                      <SelectItem value="identify_gap">
                        Identify a research gap
                      </SelectItem>
                      <SelectItem value="build_project">
                        Build a project
                      </SelectItem>
                      <SelectItem value="write_paper">
                        Write a research paper
                      </SelectItem>
                      <SelectItem value="explore_area">
                        Explore a research area
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="experienceLevel"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm font-semibold text-slate-700">
                    Research experience
                  </FormLabel>

                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10">
                        <BarChart3 className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                        <SelectValue placeholder="Select experience" />
                      </SelectTrigger>
                    </FormControl>

                    <SelectContent>
                      <SelectItem value="beginner">
                        Beginner
                      </SelectItem>
                      <SelectItem value="intermediate">
                        Intermediate
                      </SelectItem>
                      <SelectItem value="advanced">
                        Advanced
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* INTERESTS AND SKILLS */}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* RESEARCH INTERESTS */}

            <FormField
              control={form.control}
              name="topics"
              render={() => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-semibold text-slate-700">
                    Research interests
                  </FormLabel>

                  <FormControl>
                    <div className="relative">
                      <Target className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Type and press Enter"
                        value={topicInput}
                        onChange={(event) =>
                          setTopicInput(event.target.value)
                        }
                        onKeyDown={handleAddTopic}
                        className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10 text-sm focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                      />
                    </div>
                  </FormControl>

                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_INTERESTS.filter(
                      (interest) =>
                        !topics.some(
                          (topic) =>
                            topic.toLowerCase() ===
                            interest.toLowerCase()
                        )
                    )
                      .slice(0, 8)
                      .map((interest) => (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => addTopic(interest)}
                          className={suggestionClass}
                        >
                          + {interest}
                        </button>
                      ))}
                  </div>

                  {topics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {topics.map((topic) => (
                        <Badge
                          key={topic}
                          className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                        >
                          {topic}
                          <button
                            type="button"
                            onClick={() => handleRemoveTopic(topic)}
                            className="ml-1.5 rounded-full text-indigo-400 transition-colors hover:text-indigo-700"
                            aria-label={'Remove ' + topic}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <FormMessage />
                </FormItem>
              )}
            />

            {/* TECHNICAL SKILLS */}

            <FormItem className="space-y-2">
              <FormLabel className="text-sm font-semibold text-slate-700">
                Technical skills{' '}
                <span className="font-normal text-slate-400">
                  (Optional)
                </span>
              </FormLabel>

              <FormControl>
                <div className="relative">
                  <Code2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Type and press Enter"
                    value={skillInput}
                    onChange={(event) =>
                      setSkillInput(event.target.value)
                    }
                    onKeyDown={handleAddSkill}
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10 text-sm focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>
              </FormControl>

              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_SKILLS.filter(
                  (skill) =>
                    !skills.some(
                      (selectedSkill) =>
                        selectedSkill.toLowerCase() ===
                        skill.toLowerCase()
                    )
                )
                  .slice(0, 8)
                  .map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => addSkill(skill)}
                      className={suggestionClass}
                    >
                      + {skill}
                    </button>
                  ))}
              </div>

              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {skills.map((skill) => (
                    <Badge
                      key={skill}
                      className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="ml-1.5 rounded-full text-slate-400 transition-colors hover:text-slate-700"
                        aria-label={'Remove ' + skill}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </FormItem>
          </div>
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
                Creating account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>

          <p className="mt-2 text-center text-xs leading-4 text-slate-400">
            Your research profile personalizes your ResearchPilot experience.
          </p>
        </div>
      </form>
    </Form>
  );
}
