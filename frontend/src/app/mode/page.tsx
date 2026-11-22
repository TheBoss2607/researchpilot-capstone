'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Users, User, BookOpen } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ModeContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get('type');

  const isWork = type === 'work';

  return (
    <main className="relative min-h-screen w-full bg-[#030303] text-foreground flex flex-col items-center justify-center p-4 overflow-hidden">

      {/* Background Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Back Button */}
      <div className="absolute top-8 left-8 z-20">
        <Link
          href="/recommendation-type"
          className="flex items-center text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Link>
      </div>

      {/* Profile Button */}
      <div className="absolute top-8 right-8 z-20">
        <Link
          href="/account_view?returnTo=/mode?type=work"
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-2"
        >
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">Profile</span>
        </Link>
      </div>

      {/* Heading */}
      <div className="relative z-10 mb-12 text-center animate-in fade-in-0 duration-500">

        <div className="flex justify-center mb-5">
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
            <BookOpen className="h-10 w-10 text-primary" />
          </div>
        </div>

        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Article Recommendations
        </h1>

        <p className="mt-4 text-lg text-muted-foreground max-w-xl">
          Choose how you want ResearchPilot to personalize your research paper recommendations.
        </p>
      </div>

      {/* Recommendation Modes */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">

        {/* Individual */}
        <Link
          href="/interests"
          className="group animate-in fade-in-0 slide-in-from-bottom-10 duration-700"
        >
          <Card className="h-full transform transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-primary/20 bg-black/40 border-white/10 backdrop-blur-xl group-hover:border-primary/30">

            <CardHeader className="flex flex-col items-center justify-center text-center p-10">

              <div className="mb-6 rounded-2xl bg-primary/10 border border-primary/20 p-5 group-hover:bg-primary/20 transition-colors">
                <User className="h-12 w-12 text-primary" />
              </div>

              <CardTitle className="text-2xl font-semibold">
                Individual Recommendations
              </CardTitle>

              <CardDescription className="mt-3 text-base">
                Get research papers recommended specifically for your
                interests, goals and research profile.
              </CardDescription>

              <div className="mt-6 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Continue →
              </div>

            </CardHeader>

          </Card>
        </Link>

        {/* Group */}
        <Link
          href="/group"
          className="group animate-in fade-in-0 slide-in-from-bottom-10 duration-700 [animation-delay:150ms]"
        >
          <Card className="h-full transform transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-accent/20 bg-black/40 border-white/10 backdrop-blur-xl group-hover:border-accent/30">

            <CardHeader className="flex flex-col items-center justify-center text-center p-10">

              <div className="mb-6 rounded-2xl bg-accent/10 border border-accent/20 p-5 group-hover:bg-accent/20 transition-colors">
                <Users className="h-12 w-12 text-accent" />
              </div>

              <CardTitle className="text-2xl font-semibold">
                Group Recommendations
              </CardTitle>

              <CardDescription className="mt-3 text-base">
                Combine the research interests of multiple members
                and discover papers suitable for your entire group.
              </CardDescription>

              <div className="mt-6 text-sm text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                Continue →
              </div>

            </CardHeader>

          </Card>
        </Link>

      </div>

      {/* Footer */}
      <div className="relative z-10 mt-12 text-sm text-muted-foreground">
        ResearchPilot • Personalized Research Discovery
      </div>

    </main>
  );
}

export default function ModePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#030303] text-white">
          Loading...
        </div>
      }
    >
      <ModeContent />
    </Suspense>
  );
}