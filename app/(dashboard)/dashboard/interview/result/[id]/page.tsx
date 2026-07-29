'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  XCircle,
  Download,
  ArrowLeft,
  Clock,
  Timer,
  Loader2,
} from 'lucide-react';
import { getInterview, type Interview } from '@/lib/api';

export default function InterviewResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getInterview(id)
      .then((data) => { if (!cancelled) setInterview(data); })
      .catch(() => { /* non-fatal — result page shows partial data */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  // Evaluation scores are not yet generated (Phase 4), so we show placeholders.
  const metrics = [
    { label: 'Technical Skills',  score: null },
    { label: 'Communication',     score: null },
    { label: 'Confidence',        score: null },
    { label: 'Problem Solving',   score: null },
  ];

  return (
    <div className="flex-1 p-8 pt-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Interview Results</h2>
          {interview && (
            <p className="text-muted-foreground mt-1 capitalize">
              {interview.role} — {interview.interviewType} · {interview.difficulty}
            </p>
          )}
        </div>
        <div className="flex gap-4">
          <Link href="/dashboard">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
          <Button className="gap-2" disabled>
            <Download className="w-4 h-4" />
            Download Report
          </Button>
        </div>
      </div>

      {/* Duration cards */}
      {loading ? (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading interview details…</span>
        </div>
      ) : interview ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <Clock className="w-3.5 h-3.5" />
              Planned Duration
            </div>
            <p className="text-2xl font-bold">{interview.duration} min</p>
          </Card>

          <Card className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <Timer className="w-3.5 h-3.5" />
              Actual Duration
            </div>
            <p className="text-2xl font-bold">
              {interview.actualDuration != null
                ? `${interview.actualDuration} min`
                : '—'}
            </p>
          </Card>

          <Card className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              Status
            </div>
            <Badge
              variant="outline"
              className={
                interview.status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-500 text-sm'
                  : 'bg-muted text-muted-foreground text-sm'
              }
            >
              {interview.status}
            </Badge>
          </Card>

          <Card className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              Date
            </div>
            <p className="text-sm font-medium">
              {new Date(interview.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </Card>
        </div>
      ) : null}

      {/* Score section — placeholder until evaluation is generated */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="flex flex-col items-center justify-center p-6 bg-primary/5 border-primary/20">
          <h3 className="font-semibold text-lg mb-4">Overall Score</h3>
          <div className="relative w-40 h-40 flex items-center justify-center rounded-full border-8 border-muted">
            <span className="text-2xl font-bold text-muted-foreground">—</span>
          </div>
          <p className="mt-4 text-sm text-center text-muted-foreground">
            Evaluation not yet available.
          </p>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {metrics.map((metric) => (
              <div key={metric.label} className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>{metric.label}</span>
                  <span className="text-muted-foreground">—</span>
                </div>
                <Progress value={0} className="h-2 opacity-30" />
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
            <p className="text-sm text-muted-foreground">
              Strengths will appear here after evaluation is generated.
            </p>
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
            <p className="text-sm text-muted-foreground">
              Improvement areas will appear here after evaluation is generated.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Recommendations will be available after the AI evaluation is complete.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
