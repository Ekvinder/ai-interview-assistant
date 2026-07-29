'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Download, ArrowLeft } from 'lucide-react';

export default function InterviewResultPage({ params }: { params: { id: string } }) {
  // Dummy data for UI demonstration
  const overallScore = 85;
  const metrics = [
    { label: 'Technical Skills', score: 90 },
    { label: 'Communication', score: 80 },
    { label: 'Confidence', score: 75 },
    { label: 'Problem Solving', score: 95 },
  ];

  return (
    <div className="flex-1 p-8 pt-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Interview Results</h2>
          <p className="text-muted-foreground mt-2">
            Detailed performance report for your recent session.
          </p>
        </div>
        <div className="flex gap-4">
          <Link href="/dashboard">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
          <Button className="gap-2">
            <Download className="w-4 h-4" />
            Download Report
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Overall Score */}
        <Card className="flex flex-col items-center justify-center p-6 bg-primary/5 border-primary/20">
          <h3 className="font-semibold text-lg mb-6">Overall Score</h3>
          <div className="relative w-40 h-40 flex items-center justify-center rounded-full border-8 border-muted">
            {/* Fake circular progress */}
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="46%"
                className="stroke-primary fill-none"
                strokeWidth="8%"
                strokeDasharray="289"
                strokeDashoffset={289 - (289 * overallScore) / 100}
                strokeLinecap="round"
              />
            </svg>
            <span className="text-4xl font-bold">{overallScore}%</span>
          </div>
          <p className="mt-6 text-sm text-center text-muted-foreground">
            Great job! You performed better than 78% of candidates.
          </p>
        </Card>

        {/* Detailed Metrics */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {metrics.map((metric) => (
              <div key={metric.label} className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>{metric.label}</span>
                  <span>{metric.score}%</span>
                </div>
                <Progress value={metric.score} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-500">
              <CheckCircle2 className="w-5 h-5" />
              Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="text-emerald-500">•</span>
                Excellent grasp of React fundamentals and hooks.
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500">•</span>
                Structured problem-solving approach.
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-500">•</span>
                Clear and concise communication.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <XCircle className="w-5 h-5" />
              Areas for Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="text-red-500">•</span>
                Review advanced state management patterns (Redux/Zustand).
              </li>
              <li className="flex gap-2">
                <span className="text-red-500">•</span>
                Work on avoiding filler words (um, like) during explanations.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Based on this interview, we recommend focusing on system design concepts for frontend applications. 
            You handled the technical questions perfectly, but taking a moment to structure your thoughts before speaking 
            will improve your confidence score. Consider practicing a "Senior Frontend" scenario next.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
