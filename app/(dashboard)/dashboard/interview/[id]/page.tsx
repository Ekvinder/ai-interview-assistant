'use client';

import '@livekit/components-styles';
import { use, useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
  useRoomInfo,
  useTrackToggle,
} from '@livekit/components-react';
import { ConnectionState, Track } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Mic,
  MicOff,
  Volume2,
  PhoneOff,
  Wifi,
  WifiOff,
  Clock,
  Bot,
  User,
  MessageSquare,
  Loader2,
  Users,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { getInterview, updateInterview, type Interview } from '@/lib/api';
import type { GeminiSessionStatus, GeminiMessage } from '@/lib/gemini/session-store';

// ─── Constants ────────────────────────────────────────────────────────────────

const LIVEKIT_TOKEN_KEY = 'livekit_session_token';

interface StoredSession {
  token: string;
  url: string;
  interviewId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function liveKitLabel(state: ConnectionState): string {
  switch (state) {
    case ConnectionState.Connecting:   return 'Connecting…';
    case ConnectionState.Connected:    return 'Connected';
    case ConnectionState.Reconnecting: return 'Reconnecting…';
    case ConnectionState.Disconnected: return 'Disconnected';
    default:                           return 'Unknown';
  }
}

function liveKitBadgeClass(state: ConnectionState): string {
  switch (state) {
    case ConnectionState.Connected:    return 'bg-emerald-500/10 text-emerald-500';
    case ConnectionState.Reconnecting: return 'bg-yellow-500/10 text-yellow-500';
    case ConnectionState.Disconnected: return 'bg-destructive/10 text-destructive';
    default:                           return 'bg-muted text-muted-foreground';
  }
}

function geminiLabel(status: GeminiSessionStatus): string {
  switch (status) {
    case 'connecting':   return 'Connecting…';
    case 'connected':    return 'Connected';
    case 'listening':    return 'Listening';
    case 'thinking':     return 'Thinking…';
    case 'speaking':     return 'Speaking…';
    case 'disconnected': return 'Disconnected';
    case 'error':        return 'AI Unavailable';
  }
}

function geminiBadgeClass(status: GeminiSessionStatus): string {
  switch (status) {
    case 'connected':
    case 'listening':  return 'bg-blue-500/10 text-blue-500';
    case 'speaking':   return 'bg-emerald-500/10 text-emerald-500';
    case 'thinking':
    case 'connecting': return 'bg-yellow-500/10 text-yellow-500';
    case 'error':
    case 'disconnected': return 'bg-destructive/10 text-destructive';
  }
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function InterviewRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [interview, setInterview]       = useState<Interview | null>(null);
  const [session, setSession]           = useState<StoredSession | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Idempotency guard — interview completion fires exactly once
  const completionFiredRef = useRef(false);

  // Load interview metadata
  useEffect(() => {
    let cancelled = false;
    getInterview(id)
      .then((d) => { if (!cancelled) setInterview(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  // Retrieve the LiveKit token placed by the waiting room
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LIVEKIT_TOKEN_KEY);
      if (!raw) { setSessionError('No session found. Please join from the waiting room.'); return; }
      const parsed: StoredSession = JSON.parse(raw);
      if (parsed.interviewId !== id) { setSessionError('Session mismatch. Please rejoin.'); return; }
      setSession(parsed);
    } catch {
      setSessionError('Failed to read session. Please rejoin from the waiting room.');
    }
  }, [id]);

  /** Complete the interview — idempotent, called from every end path. */
  const completeInterview = useCallback(
    (options?: { keepalive?: boolean }) => {
      if (completionFiredRef.current) return;
      completionFiredRef.current = true;

      sessionStorage.removeItem(LIVEKIT_TOKEN_KEY);

      // Close the Gemini session server-side (best-effort, keepalive for tab close)
      fetch(`/api/gemini/session/${id}`, {
        method: 'DELETE',
        keepalive: true,
      }).catch(() => {});

      const endedAt = new Date().toISOString();
      const body = JSON.stringify({ status: 'completed', endedAt });

      if (options?.keepalive) {
        fetch(`/api/interviews/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      } else {
        updateInterview(id, { status: 'completed', endedAt }).catch(() => {});
        router.push(`/dashboard/interview/result/${id}`);
      }
    },
    [id, router],
  );

  // beforeunload — browser/tab close
  useEffect(() => {
    const h = () => completeInterview({ keepalive: true });
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [completeInterview]);

  // ── Error / loading ───────────────────────────────────────────────────────
  if (sessionError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <WifiOff className="w-10 h-10 text-destructive opacity-60" />
        <p className="text-destructive text-sm max-w-sm">{sessionError}</p>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Preparing room…</span>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={session.token}
      serverUrl={session.url}
      connect={true}
      audio={true}
      video={false}
      onDisconnected={() => completeInterview()}
      onError={(err) => console.error('[LiveKit]', err)}
      style={{
        display: 'flex', flexDirection: 'column',
        height: '100%', overflow: 'hidden',
        background: 'hsl(var(--background))',
      }}
    >
      <RoomAudioRenderer />
      <RoomContent
        interviewId={id}
        interview={interview}
        onEnd={() => completeInterview()}
      />
    </LiveKitRoom>
  );
}

// ─── Inner content — runs inside LiveKitRoom context ─────────────────────────

function RoomContent({
  interviewId,
  interview,
  onEnd,
}: {
  interviewId: string;
  interview: Interview | null;
  onEnd: () => void;
}) {
  const connState    = useConnectionState();
  const participants = useParticipants();
  const { name: roomName }   = useRoomInfo();
  const { localParticipant } = useLocalParticipant();
  const { toggle: toggleMic, enabled: micEnabled } = useTrackToggle({
    source: Track.Source.Microphone,
  });

  // ── Gemini state ─────────────────────────────────────────────────────────
  const [geminiStatus, setGeminiStatus] = useState<GeminiSessionStatus>('connecting');
  const [geminiError,  setGeminiError]  = useState<string | null>(null);
  const [transcript,   setTranscript]   = useState<GeminiMessage[]>([]);

  /**
   * Ref tracking whether the Gemini session has been started for this mount.
   * Prevents duplicate sessions if connState briefly flickers.
   */
  const geminiStartedRef = useRef(false);
  /** Ref to the current EventSource so we can close it on cleanup. */
  const evtSourceRef     = useRef<EventSource | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // ── SSE subscriber ────────────────────────────────────────────────────────
  const openStream = useCallback(() => {
    // Close any existing EventSource first (prevents duplicate listeners)
    if (evtSourceRef.current) {
      evtSourceRef.current.close();
      evtSourceRef.current = null;
    }

    const es = new EventSource(`/api/gemini/session/${interviewId}/stream`);
    evtSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        switch (payload.type) {
          case 'sync':
            // Catchup: hydrate from server state
            setTranscript(payload.transcript ?? []);
            setGeminiStatus(payload.status ?? 'connecting');
            setGeminiError(null);
            break;

          case 'status':
            setGeminiStatus(payload.status);
            if (payload.status !== 'error') setGeminiError(null);
            break;

          case 'message':
            // Full, completed message — add to transcript list
            setTranscript((prev) => {
              // Avoid duplicates: if a matching chunk was streamed, replace the
              // last partial entry with the complete one (same speaker, close timestamp)
              const entry: GeminiMessage = {
                speaker: payload.speaker,
                text: payload.text,
                timestamp: payload.timestamp,
              };
              return [...prev, entry];
            });
            break;

          case 'chunk':
            // Streaming partial text — update the last AI entry in-place if pending,
            // otherwise no-op (the 'message' event will add the completed version)
            // We don't display chunks in the transcript list to avoid flicker —
            // the completed 'message' event handles the final display.
            break;

          case 'error':
            setGeminiStatus('error');
            setGeminiError(payload.message ?? 'AI error');
            break;

          case 'close':
            es.close();
            evtSourceRef.current = null;
            break;
        }
      } catch {
        // Malformed event — ignore
      }
    };

    es.onerror = () => {
      setGeminiStatus('disconnected');
    };
  }, [interviewId]);

  // ── Start Gemini after LiveKit connects — exactly once ───────────────────
  useEffect(() => {
    if (connState !== ConnectionState.Connected) return;
    if (geminiStartedRef.current) return;
    geminiStartedRef.current = true;

    const start = async () => {
      setGeminiStatus('connecting');
      setGeminiError(null);

      try {
        const res = await fetch(`/api/gemini/session/${interviewId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role:          interview?.role          ?? 'Software Engineer',
            interviewType: interview?.interviewType ?? 'technical',
            difficulty:    interview?.difficulty    ?? 'medium',
            experience:    interview?.experience    ?? '1-2 years',
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.message ?? 'Failed to start AI session');
        }

        // Open the SSE stream to receive events
        openStream();
      } catch (err: any) {
        console.error('[Gemini Session]', err);
        setGeminiStatus('error');
        setGeminiError(err.message ?? 'AI failed to start');
      }
    };

    start();
  }, [connState, interviewId, interview, openStream]);

  // ── Cleanup SSE on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      evtSourceRef.current?.close();
      evtSourceRef.current = null;
    };
  }, []);

  // ── Retry ────────────────────────────────────────────────────────────────
  const handleRetry = useCallback(async () => {
    // Close existing stream and session
    evtSourceRef.current?.close();
    evtSourceRef.current = null;
    geminiStartedRef.current = false;

    setGeminiStatus('connecting');
    setGeminiError(null);
    setTranscript([]);

    // Delete the old server session first (in case it's in error state)
    await fetch(`/api/gemini/session/${interviewId}`, { method: 'DELETE' }).catch(() => {});

    // Re-start
    geminiStartedRef.current = true;
    try {
      const res = await fetch(`/api/gemini/session/${interviewId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role:          interview?.role          ?? 'Software Engineer',
          interviewType: interview?.interviewType ?? 'technical',
          difficulty:    interview?.difficulty    ?? 'medium',
          experience:    interview?.experience    ?? '1-2 years',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? 'Failed to restart AI session');
      openStream();
    } catch (err: any) {
      setGeminiStatus('error');
      setGeminiError(err.message ?? 'AI failed to restart');
    }
  }, [interviewId, interview, openStream]);

  const title = interview
    ? `${interview.role} — ${interview.interviewType}`
    : 'Interview Room';

  const aiAnimated =
    geminiStatus === 'speaking' || geminiStatus === 'thinking' || geminiStatus === 'listening';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-muted/20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="font-semibold capitalize truncate">{title}</h1>
          <Badge variant="outline" className={liveKitBadgeClass(connState)}>
            <Wifi className="w-3 h-3 mr-1" />
            {liveKitLabel(connState)}
          </Badge>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {/* Real Gemini status */}
          <Badge variant="outline" className={geminiBadgeClass(geminiStatus)}>
            <Bot className="w-3 h-3 mr-1" />
            AI: {geminiLabel(geminiStatus)}
          </Badge>

          {interview && (
            <>
              <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                <Clock className="w-4 h-4" />
                <span>{interview.duration} min planned</span>
              </div>
              <Badge variant="outline" className="capitalize">{interview.difficulty}</Badge>
            </>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <Users className="w-4 h-4" />
            <span>{participants.length}</span>
          </div>
          {roomName && (
            <span className="text-xs text-muted-foreground font-mono hidden md:inline truncate max-w-[160px]">
              {roomName}
            </span>
          )}
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Center stage */}
        <div className="flex-1 flex flex-col p-6">
          <div className="flex-1 flex flex-col items-center justify-center gap-12 relative">

            {/* AI Avatar */}
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                {aiAnimated && (
                  <div className="absolute inset-0 rounded-full animate-ping bg-primary/20 scale-150" />
                )}
                <Avatar className="w-32 h-32 border-4 border-primary/20 shadow-xl relative z-10">
                  <AvatarFallback
                    className={
                      geminiStatus === 'error'
                        ? 'bg-destructive/20 text-destructive'
                        : 'bg-primary text-primary-foreground'
                    }
                  >
                    {geminiStatus === 'error'
                      ? <AlertCircle className="w-16 h-16" />
                      : <Bot className="w-16 h-16" />}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Status label under avatar */}
              {(geminiStatus === 'connecting' || geminiStatus === 'thinking') && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {geminiLabel(geminiStatus)}
                </div>
              )}
              {(geminiStatus === 'speaking' || geminiStatus === 'listening' || geminiStatus === 'connected') && (
                <div className="flex gap-1 h-8 items-center">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-2 bg-primary rounded-full animate-pulse"
                      style={{ height: `${(i + 1) * 20}%`, animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              )}
              {(geminiStatus === 'error' || geminiStatus === 'disconnected') && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm text-destructive text-center max-w-[200px]">
                    {geminiError ?? 'AI is unavailable'}
                  </p>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={handleRetry}>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry AI
                  </Button>
                </div>
              )}
            </div>

            {/* Local participant bubble */}
            <div className="flex flex-col items-center gap-3 absolute bottom-12 right-12">
              <Avatar className="w-24 h-24 border-2 border-muted shadow-lg">
                <AvatarFallback className="bg-muted text-muted-foreground">
                  <User className="w-10 h-10" />
                </AvatarFallback>
              </Avatar>
              <Badge
                variant="outline"
                className={micEnabled
                  ? 'gap-1 bg-emerald-500/10 text-emerald-500'
                  : 'gap-1 bg-muted text-muted-foreground'}
              >
                {micEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                {localParticipant?.identity ?? 'You'}
              </Badge>
            </div>

          </div>

          {/* Controls */}
          <div className="h-20 bg-muted/40 rounded-2xl flex items-center justify-center gap-4 border shrink-0">
            <Button
              variant={micEnabled ? 'secondary' : 'destructive'}
              size="icon" className="w-12 h-12 rounded-full"
              onClick={() => toggleMic()}
              title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
            >
              {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </Button>
            <Button variant="secondary" size="icon" className="w-12 h-12 rounded-full">
              <Volume2 className="w-5 h-5" />
            </Button>
            <Button
              variant="destructive" size="icon" className="w-12 h-12 rounded-full"
              onClick={onEnd}
              title="End interview"
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* ── Transcript sidebar ───────────────────────────────────────── */}
        <div className="w-96 border-l bg-muted/10 flex flex-col shrink-0">
          <div className="p-4 border-b flex items-center justify-between bg-background">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Live Transcript
            </h3>
            <Badge variant="outline" className={`text-xs ${geminiBadgeClass(geminiStatus)}`}>
              {geminiLabel(geminiStatus)}
            </Badge>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">

            {/* Connecting state */}
            {geminiStatus === 'connecting' && transcript.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-6">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                AI interviewer is connecting…
              </div>
            )}

            {/* Error state */}
            {(geminiStatus === 'error' || geminiStatus === 'disconnected') && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                <div className="flex items-center gap-2 mb-1 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {geminiStatus === 'disconnected' ? 'AI Disconnected' : 'AI Unavailable'}
                </div>
                <p className="text-xs">{geminiError ?? 'The AI interviewer disconnected.'}</p>
                <Button
                  size="sm" variant="outline"
                  className="mt-2 gap-1.5 h-7 text-xs"
                  onClick={handleRetry}
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </Button>
              </div>
            )}

            {/* Transcript messages */}
            {transcript.map((entry, i) => (
              <div
                key={i}
                className={`flex flex-col gap-1 ${entry.speaker === 'user' ? 'items-end' : 'items-start'}`}
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {entry.speaker === 'ai' ? 'AI Interviewer' : 'You'}
                </span>
                <Card
                  className={`p-3 border-none text-sm leading-relaxed ${
                    entry.speaker === 'ai'
                      ? 'bg-muted rounded-tl-none'
                      : 'bg-primary text-primary-foreground rounded-tr-none'
                  }`}
                >
                  {entry.text}
                </Card>
              </div>
            ))}

            {/* Thinking indicator — shown while AI is generating */}
            {geminiStatus === 'thinking' && (
              <div className="flex flex-col gap-1 items-start">
                <span className="text-xs font-medium text-muted-foreground">AI Interviewer</span>
                <Card className="p-3 bg-muted border-none rounded-tl-none">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </Card>
              </div>
            )}

            <div ref={transcriptEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
}
