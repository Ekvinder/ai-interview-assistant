'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createInterview } from '@/lib/api';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export default function CreateInterviewPage() {
  const router = useRouter();

  const [role, setRole] = useState('');
  const [interviewType, setInterviewType] = useState('technical');
  const [difficulty, setDifficulty] = useState('medium');
  const [experience, setExperience] = useState('1-2 years');
  const [duration, setDuration] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const interview = await createInterview({
        role: role.trim(),
        interviewType,
        difficulty,
        experience,
        duration,
      });

      router.push(`/dashboard/interview/waiting/${interview._id}`);
    } catch (err: any) {
      setError(err.message ?? 'Failed to create interview. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-8 pt-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Create Interview</h2>
        <p className="text-muted-foreground mt-2">
          Configure your AI interview scenario to match your target role.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Interview Details</CardTitle>
            <CardDescription>
              Fill out the details below to generate a tailored interview experience.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="role">Role / Position</Label>
              <Input
                id="role"
                placeholder="e.g., Frontend Engineer"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Interview Type</Label>
                <select
                  id="type"
                  className={selectClass}
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value)}
                >
                  <option value="technical">Technical</option>
                  <option value="behavioral">Behavioral / HR</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty</Label>
                <select
                  id="difficulty"
                  className={selectClass}
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="experience">Experience Level</Label>
                <select
                  id="experience"
                  className={selectClass}
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                >
                  <option value="intern">Intern / Fresher</option>
                  <option value="1-2 years">1–2 Years</option>
                  <option value="3-5 years">3–5 Years</option>
                  <option value="5+ years">Senior (5+ Years)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (Minutes)</Label>
                <select
                  id="duration"
                  className={selectClass}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                >
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={45}>45</option>
                  <option value={60}>60</option>
                </select>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between border-t p-6">
            <Button
              variant="ghost"
              type="button"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Start Interview'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
