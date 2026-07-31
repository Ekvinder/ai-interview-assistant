'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Mic, Volume2, Wifi, Bot, VideoOff, Loader2 } from 'lucide-react';
import { getInterview, updateInterview, getLiveKitToken, type Interview } from '@/lib/api';

// Key used to hand the token to the interview room without a second API call.
export const LIVEKIT_TOKEN_KEY = 'livekit_session_token';

export default function WaitingRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [interview, setInterview] = useState<Interview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinStep, setJoinStep] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  // ── Load interview details ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getInterview(id);
        if (!cancelled) setInterview(data);
      } catch (err: unknown) {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error('Failed to load interview details.');
          setLoadError(error.message);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  // ── Join flow ─────────────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (!interview) return;
    setJoinError(null);
    setJoining(true);

    try {
      // Step 1 – mark interview as active
      setJoinStep('Activating interview…');
      await updateInterview(id, {
        status: 'active',
        startedAt: new Date().toISOString(),
      });

      // Step 2 – get LiveKit token for this room
      setJoinStep('Joining room…');
      // Use interview _id as participant identity so it is unique per session
      const { token, url } = await getLiveKitToken(interview.roomName, id);

      // Step 3 – stash token for the interview room to pick up
      sessionStorage.setItem(LIVEKIT_TOKEN_KEY, JSON.stringify({ token, url, interviewId: id }));

      // Step 4 – navigate to the interview room
      router.push(`/dashboard/interview/${id}`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Failed to join. Please try again.');
      setJoinError(error.message);
      setJoining(false);
      setJoinStep(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/10 h-full">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Waiting Room</h2>
        <p className="text-muted-foreground mt-2">
          Check your equipment before joining the interview.
        </p>
      </div>

      {/* Interview details banner */}
      {interview && (
        <div className="mb-6 w-full max-w-5xl flex flex-wrap gap-3 justify-center">
          <Badge variant="outline" className="text-sm px-3 py-1 capitalize">
            {interview.role}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1 capitalize">
            {interview.interviewType}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1 capitalize">
            {interview.difficulty}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            {interview.duration} min
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1 capitalize">
            {interview.experience}
          </Badge>
        </div>
      )}

      {loadError && (
        <div className="mb-6 w-full max-w-5xl rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive text-center">
          {loadError}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8 w-full max-w-5xl">
        {/* Camera preview placeholder */}
        <div className="md:col-span-2">
          <Card className="overflow-hidden bg-black aspect-video flex items-center justify-center border-muted">
            <div className="text-center text-muted-foreground flex flex-col items-center">
              <VideoOff className="h-12 w-12 mb-4 opacity-50" />
              <p>Camera is off</p>
            </div>
          </Card>
        </div>

        {/* Status panel + actions */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Status</h3>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Camera</span>
                </div>
                <Badge variant="outline" className="text-yellow-500 bg-yellow-500/10">
                  Disabled
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Microphone</span>
                </div>
                <Badge variant="outline" className="text-emerald-500 bg-emerald-500/10">
                  Ready
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Speaker</span>
                </div>
                <Badge variant="outline" className="text-emerald-500 bg-emerald-500/10">
                  Ready
                </Badge>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Connection</span>
                </div>
                <Badge variant="outline" className="text-emerald-500 bg-emerald-500/10">
                  Excellent
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">AI Agent</span>
                </div>
                {interview ? (
                  <Badge variant="outline" className="text-blue-500 bg-blue-500/10">
                    Ready
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-yellow-500 bg-yellow-500/10">
                    Loading…
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {joinError && (
            <p className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive text-center">
              {joinError}
            </p>
          )}

          {joining && joinStep && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {joinStep}
            </p>
          )}

          <div className="flex gap-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push('/dashboard')}
              disabled={joining}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleJoin}
              disabled={!interview || joining}
            >
              {joining ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Joining…
                </>
              ) : (
                'Join Interview'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
