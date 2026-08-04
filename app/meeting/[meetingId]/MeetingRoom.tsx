'use client';

import '@livekit/components-styles';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
  useTrackToggle,
  useTracks,
  useIsSpeaking,
  useParticipantInfo,
  useChat,
  useDataChannel,
} from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder, ReceivedChatMessage } from '@livekit/components-react';
import { ConnectionState, Track, Participant } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { roomOptions } from '@/lib/livekit-client-options';
import {
  Mic, MicOff,
  Video, VideoOff,
  MonitorUp, MonitorOff,
  PhoneOff,
  Wifi,
  WifiOff,
  Hash,
  Clock,
  Users,
  Loader2,
  RefreshCw,
  AlertCircle,
  Monitor,
  X,
  Crown,
  MessageSquare,
  Send,
  ShieldAlert,
  Lock,
  UserMinus,
  XCircle,
  PenTool,
  Eraser,
  Trash2,
  Undo2,
  Redo2,
} from 'lucide-react';
import { getLiveKitToken } from '@/lib/api';
import { meetingClientService } from '@/services/client/meeting.service';
import { toast } from 'sonner';
import ScreenShareView from './components/ScreenShareView';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeetingInfo {
  title: string;
  meetingId: string;
  status: string;
  _id: string;
}

export const MEETING_TOKEN_KEY = 'meeting_livekit_token';

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function connLabel(state: ConnectionState): string {
  switch (state) {
    case ConnectionState.Connecting:   return 'Connecting…';
    case ConnectionState.Connected:    return 'Connected';
    case ConnectionState.Reconnecting: return 'Reconnecting…';
    case ConnectionState.Disconnected: return 'Disconnected';
    default:                           return 'Unknown';
  }
}

function connBadgeClass(state: ConnectionState): string {
  switch (state) {
    case ConnectionState.Connected:    return 'bg-emerald-500/10 text-emerald-500';
    case ConnectionState.Reconnecting: return 'bg-yellow-500/10 text-yellow-500';
    case ConnectionState.Disconnected: return 'bg-destructive/10 text-destructive';
    default:                           return 'bg-muted text-muted-foreground';
  }
}

function resolveDisplayName(name: string | undefined, identity: string | undefined): string {
  if (name?.trim()) return name.trim();
  if (identity?.trim()) return identity.trim();
  return 'Unknown';
}

function makeInitials(name: string): string {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

function isMicMuted(micRef: TrackReferenceOrPlaceholder | undefined): boolean {
  if (!micRef) return true;
  if (!('publication' in micRef)) return true;
  if (!micRef.publication) return true;
  return micRef.publication.isMuted;
}

// ─── Duration timer ───────────────────────────────────────────────────────────

// Isolated component — only the clock text re-renders every second,
// not the entire RoomContent tree.
function DurationClock({ running }: { running: boolean }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return <span className="font-mono tabular-nums">{mm}:{ss}</span>;
}
// ─── Root component ───────────────────────────────────────────────────────────

interface MeetingRoomProps {
  meeting: MeetingInfo;
  userId: string;
  userName: string;
  userEmail: string;
  hostUserId?: string;
}

export default function MeetingRoom({ meeting, userId, userName, userEmail, hostUserId }: MeetingRoomProps) {
  const router = useRouter();
  const [token, setToken]           = useState<string | null>(null);
  const [serverUrl, setServerUrl]   = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [joinStatus, setJoinStatus] = useState<'pending' | 'approved' | 'denied'>(userId === hostUserId ? 'approved' : 'pending');
  const [loading, setLoading]       = useState(userId === hostUserId);
  const leftRef = useRef(false);
  const isHost = userId === hostUserId;

  useEffect(() => {
    let cancelled = false;
    async function requestAdmission() {
      if (isHost) return;
      setLoading(true);
      try {
        // A prior token must not let a guest bypass a new approval decision.
        sessionStorage.removeItem(MEETING_TOKEN_KEY);
        await meetingClientService.joinMeeting(meeting.meetingId);
        const status = await meetingClientService.getJoinRequestStatus(meeting.meetingId);
        if (!cancelled) setJoinStatus(status);
      } catch (err) {
        if (!cancelled) setTokenError((err as Error).message || 'Failed to request admission');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    requestAdmission();
    return () => { cancelled = true; };
  }, [isHost, meeting.meetingId]);

  useEffect(() => {
    if (isHost || joinStatus !== 'pending') return;
    let delay = 2000;
    let timerId: ReturnType<typeof setTimeout>;
    let active = true;

    const poll = async () => {
      try {
        const status = await meetingClientService.getJoinRequestStatus(meeting.meetingId);
        if (!active) return;
        setJoinStatus(status);
        // Stop polling once the host made a decision
        if (status !== 'pending') return;
      } catch { /* transient — keep retrying */ }
      // Exponential backoff: 2 s → 4 s → 8 s → cap at 10 s
      delay = Math.min(delay * 1.5, 10_000);
      timerId = setTimeout(poll, delay);
    };

    timerId = setTimeout(poll, delay);
    return () => { active = false; clearTimeout(timerId); };
  }, [isHost, joinStatus, meeting.meetingId]);

  useEffect(() => {
    let cancelled = false;
    async function getApprovedToken() {
      if (joinStatus !== 'approved') return;
      setLoading(true);
      setTokenError(null);
      try {
        const { token: t, url: u } = await getLiveKitToken(
          meeting.meetingId,
          userId,
          { name: userName, metadata: JSON.stringify({ userId, email: userEmail, name: userName }) },
        );
        if (!cancelled) { setToken(t); setServerUrl(u); }
      } catch (err) {
        const e = err as Error;
        if (!cancelled) setTokenError(e.message || 'Failed to get meeting token');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    getApprovedToken();
    return () => { cancelled = true; };
  }, [joinStatus, meeting.meetingId, userId, userName, userEmail]);

  const handleLeave = useCallback(() => {
    if (leftRef.current) return;
    leftRef.current = true;
    sessionStorage.removeItem(MEETING_TOKEN_KEY);
    // Do not make navigation depend on a network round trip. Unmounting the
    // room disconnects LiveKit immediately; the API call only records it.
    void meetingClientService.leaveMeeting(meeting.meetingId).catch(() => undefined);
    router.replace('/dashboard');
  }, [meeting.meetingId, router]);

  useEffect(() => {
    const h = () => {
      sessionStorage.removeItem(MEETING_TOKEN_KEY);
      navigator.sendBeacon(`/api/meetings/${meeting.meetingId}/leave`);
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [meeting.meetingId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Connecting to meeting…</p>
      </div>
    );
  }

  if (joinStatus === 'pending' && !isHost) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
        <Clock className="w-10 h-10 text-muted-foreground opacity-60" />
        <h2 className="font-semibold text-lg">Waiting for the host</h2>
        <p className="text-sm text-muted-foreground max-w-sm">Your join request was sent. Your camera and microphone will not connect until the host allows you in.</p>
        <Button variant="outline" onClick={handleLeave}>Leave waiting room</Button>
      </div>
    );
  }

  if (joinStatus === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
        <XCircle className="w-10 h-10 text-destructive opacity-70" />
        <h2 className="font-semibold text-lg">Join request denied</h2>
        <p className="text-sm text-muted-foreground max-w-sm">The host did not allow you to join this meeting.</p>
        <Button variant="outline" onClick={handleLeave}>Back to Dashboard</Button>
      </div>
    );
  }

  if (tokenError || !token || !serverUrl) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
        <WifiOff className="w-10 h-10 text-destructive opacity-60" />
        <h2 className="font-semibold text-lg">Unable to join</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          {tokenError || 'Could not connect to the meeting room.'}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
          <Button onClick={() => { leftRef.current = false; setLoading(true); }}>
            <RefreshCw className="w-4 h-4 mr-2" />Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      options={roomOptions}
      token={token}
      serverUrl={serverUrl}
      connect
      audio={false}
      video={false}
      onDisconnected={handleLeave}
      onError={(err) => {
        // NotAllowedError = user denied mic/camera permission — not a fatal meeting error
        if (err.name === 'NotAllowedError' || err.message?.toLowerCase().includes('permission')) {
          console.warn('[LiveKit] Device permission denied:', err.message);
          return;
        }
        console.error('[LiveKit Meeting]', err);
        toast.error('Connection error: ' + err.message);
      }}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
    >
      <RoomAudioRenderer />
      <RoomContent meeting={meeting} onLeave={handleLeave} hostUserId={hostUserId} userId={userId} />
    </LiveKitRoom>
  );
}

// ─── Inner room ───────────────────────────────────────────────────────────────

function RoomContent({ meeting, onLeave, hostUserId, userId }: { meeting: MeetingInfo; onLeave: () => void; hostUserId?: string; userId: string }) {
  const connState                                          = useConnectionState();
  const participants                                       = useParticipants();
  const { localParticipant, isScreenShareEnabled }         = useLocalParticipant();
  const isConnected                                        = connState === ConnectionState.Connected;

  // Derive isHost from props (not from localParticipant) so it is correct from
  // the very first render — before LiveKit has connected and populated
  // localParticipant. Using localParticipant?.identity here caused the host
  // polling useEffect to see isHost=false on mount, exit early, and never
  // re-register even after LiveKit connected.
  const isHost = !!(hostUserId && userId === hostUserId);

  // Panel state: 'participants' | 'chat' | 'host' | 'whiteboard' | null
  const [showPanel, setShowPanel] = useState<'participants' | 'chat' | 'host' | 'whiteboard' | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  // Ref mirrors showPanel so the unread effect always reads the current value
  const showPanelRef = useRef<'participants' | 'chat' | 'host' | 'whiteboard' | null>(null);

  const togglePanel = useCallback((panel: 'participants' | 'chat' | 'host' | 'whiteboard') => {
    setShowPanel((p) => {
      const next = p === panel ? null : panel;
      showPanelRef.current = next;
      if (next === 'chat') setUnreadCount(0); // clear badge when opening chat
      return next;
    });
  }, []);

  // ── Chat notifications ────────────────────────────────────────────────────
  // useChat is called here (inside LiveKitRoom context), not inside ChatPanel.
  const { send: sendChatMessage, chatMessages, isSending: chatSending } = useChat();

  // Ref: last processed message count (avoids re-processing on re-render)
  const prevMessageCountRef = useRef(0);
  // Ref: whether browser notification permission has been requested this session
  const notifPermRequestedRef = useRef(false);
  // Ref: debounce guard so rapid messages don't overlap sounds
  const soundPlayingRef = useRef(false);

  // Request browser notification permission once on connect (non-blocking)
  useEffect(() => {
    if (notifPermRequestedRef.current) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      notifPermRequestedRef.current = true;
      Notification.requestPermission().catch(() => {/* ignore */});
    }
  }, []);

  // Play a short beep via Web Audio API — no external file required
  const playNotificationSound = useCallback(() => {
    if (soundPlayingRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
      soundPlayingRef.current = true;
      setTimeout(() => { soundPlayingRef.current = false; }, 800);
      osc.onended = () => ctx.close().catch(() => {/* ignore */});
    } catch { /* AudioContext not available */ }
  }, []);

  useEffect(() => {
    const newCount = chatMessages.length;
    const prevCount = prevMessageCountRef.current;

    if (newCount <= prevCount) {
      prevMessageCountRef.current = newCount;
      return;
    }

    // Process each new message that arrived since last render
    const newMessages = chatMessages.slice(prevCount);
    prevMessageCountRef.current = newCount;

    for (const msg of newMessages) {
      const isOwn = msg.from?.identity === localParticipant?.identity;
      if (isOwn) continue; // never notify for own messages

      const senderName = resolveDisplayName(msg.from?.name, msg.from?.identity);
      const preview    = msg.message.length > 50 ? msg.message.slice(0, 50) + '…' : msg.message;

      // 1. Unread badge — only when chat is not open
      if (showPanelRef.current !== 'chat') {
        setUnreadCount((c) => c + 1);
      }

      // 2. Toast notification — always for incoming messages from others
      toast.message(`${senderName}: ${preview}`, {
        duration: 4000,
        description: showPanelRef.current !== 'chat' ? 'Click Chat to reply' : undefined,
      });

      // 3. Sound — always for incoming from others
      playNotificationSound();

      // 4. Browser notification — only when tab is not focused and chat is closed
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        document.visibilityState !== 'visible' &&
        showPanelRef.current !== 'chat'
      ) {
        try {
          new Notification(senderName, {
            body: preview,
            tag: 'meeting-chat', // prevents stacking
          });
        } catch { /* ignore */ }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages.length]);

  const { toggle: toggleMic,          enabled: micEnabled,    pending: micPending    } = useTrackToggle({ source: Track.Source.Microphone });
  const { toggle: toggleCamera,       enabled: cameraEnabled, pending: cameraPending } = useTrackToggle({ source: Track.Source.Camera });
  const { toggle: toggleScreenShare,  pending: screenPending  }                        = useTrackToggle({ source: Track.Source.ScreenShare });

  // ── Host controls ─────────────────────────────────────────────────────────
  const [isLocked,         setIsLocked]         = useState(false); // meeting lock placeholder
  const [whiteboardLocked, setWhiteboardLocked] = useState(false); // whiteboard lock state
  const toggleWhiteboardLock = useCallback(() => setWhiteboardLocked((l) => !l), []);
  const [removingIdentity, setRemovingIdentity] = useState<string | null>(null);
  const [endingMeeting,    setEndingMeeting]    = useState(false);

  // Host approval is deliberately outside LiveKit. A pending guest has no room
  // token, so cannot connect, publish, subscribe, or appear in this UI.
  //
  // notifiedJoinRequestsRef tracks *active* pending toasts so we don't stack
  // duplicate toasts for the same request. The entry is removed as soon as the
  // host decides (allow/deny), so if the guest re-requests after a denial the
  // host will receive a fresh notification.
  const notifiedJoinRequestsRef = useRef(new Set<string>());
  const meetingIdRef = useRef(meeting.meetingId);
  useEffect(() => { meetingIdRef.current = meeting.meetingId; }, [meeting.meetingId]);

  useEffect(() => {
    if (!isHost) return;
    let active = true;
    let timerId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const requests = await meetingClientService.getPendingJoinRequests(meetingIdRef.current);
        if (!active) return;
        for (const request of requests) {
          if (notifiedJoinRequestsRef.current.has(request.userId)) continue;
          notifiedJoinRequestsRef.current.add(request.userId);
          toast(`${request.name} wants to join`, {
            duration: Infinity,
            action: {
              label: 'Allow',
              onClick: async () => {
                // Remove from tracked set — if this user re-requests later, host gets a new toast
                notifiedJoinRequestsRef.current.delete(request.userId);
                try {
                  await meetingClientService.decideJoinRequest(meetingIdRef.current, request.userId, true);
                  toast.success(`${request.name} was allowed into the meeting`);
                } catch (err) { toast.error((err as Error).message || 'Could not approve join request'); }
              },
            },
            cancel: {
              label: 'Deny',
              onClick: async () => {
                // Remove so a re-request triggers a fresh notification
                notifiedJoinRequestsRef.current.delete(request.userId);
                try {
                  await meetingClientService.decideJoinRequest(meetingIdRef.current, request.userId, false);
                  toast.message(`${request.name}'s join request was denied`);
                } catch (err) { toast.error((err as Error).message || 'Could not deny join request'); }
              },
            },
          });
        }
      } catch { /* transient — next poll will retry */ }
      // Always poll at a steady 2 s so the host gets near-instant notifications.
      // No backoff here — this is an approval gate, latency matters.
      if (active) timerId = setTimeout(poll, 2000);
    };

    void poll();
    return () => { active = false; clearTimeout(timerId); };
  }, [isHost]);

  const handleEndMeeting = useCallback(async () => {
    if (!window.confirm('End this meeting for everyone?')) return;
    setEndingMeeting(true);
    try {
      await meetingClientService.endMeeting(meeting._id);
      onLeave();
    } catch (err) {
      toast.error('Could not end meeting: ' + (err as Error).message);
      setEndingMeeting(false);
    }
  }, [meeting._id, onLeave]);

  const handleRemoveParticipant = useCallback(async (identity: string, displayName: string) => {
    if (!window.confirm(`Remove ${displayName} from the meeting?`)) return;
    setRemovingIdentity(identity);
    try {
      await meetingClientService.removeParticipant(meeting.meetingId, identity);
      toast.success(`${displayName} was removed`);
    } catch (err) {
      toast.error('Could not remove participant: ' + (err as Error).message);
    } finally {
      setRemovingIdentity(null);
    }
  }, [meeting.meetingId]);

  const handleLockMeeting = useCallback(() => {
    setIsLocked((l) => !l);
    toast.info(isLocked ? 'Meeting unlocked (placeholder)' : 'Meeting locked (placeholder)');
  }, [isLocked]);

  const handleScreenShare = useCallback(async () => {
    try {
      await toggleScreenShare();
    } catch (err) {
      const msg = (err as Error)?.message ?? '';
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('permission')) {
        toast.error('Could not start screen share: ' + msg);
      }
    }
  }, [toggleScreenShare]);

  const handleMic = useCallback(async () => {
    try { await toggleMic(); } catch (err) { toast.error('Mic toggle failed: ' + (err as Error).message); }
  }, [toggleMic]);

  const handleCamera = useCallback(async () => {
    try { await toggleCamera(); } catch (err) { toast.error('Camera toggle failed: ' + (err as Error).message); }
  }, [toggleCamera]);

  const allCameraTracks = useTracks(
    [{ source: Track.Source.Camera,      withPlaceholder: true  }],
    { onlySubscribed: false },
  );
  const allMicTracks = useTracks(
    [{ source: Track.Source.Microphone,  withPlaceholder: true  }],
    { onlySubscribed: false },
  );
  const allScreenShareTracks = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false },
  );

  const activeScreenShare = allScreenShareTracks[0] as TrackReferenceOrPlaceholder | undefined;
  const screenShareActive = !!activeScreenShare;

  // Memoised identity maps — only rebuild when the underlying track arrays change.
  // Without useMemo these Maps are reconstructed on EVERY render (e.g. mic toggle,
  // speaking indicator tick), causing all child tiles to re-render unnecessarily.
  const cameraByIdentity = useMemo(() => {
    const map = new Map<string, TrackReferenceOrPlaceholder>();
    for (const ref of allCameraTracks) map.set(ref.participant.identity, ref);
    return map;
  }, [allCameraTracks]);

  const micByIdentity = useMemo(() => {
    const map = new Map<string, TrackReferenceOrPlaceholder>();
    for (const ref of allMicTracks) map.set(ref.participant.identity, ref);
    return map;
  }, [allMicTracks]);

  // Screen share per-identity — used by participant panel to show indicator
  const screenShareByIdentity = useMemo(() => {
    const map = new Map<string, true>();
    for (const ref of allScreenShareTracks) map.set(ref.participant.identity, true);
    return map;
  }, [allScreenShareTracks]);

  if (connState === ConnectionState.Connecting) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Joining room…</p>
      </div>
    );
  }

  if (connState === ConnectionState.Disconnected) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
        <AlertCircle className="w-10 h-10 text-destructive opacity-60" />
        <h2 className="font-semibold text-lg">Disconnected</h2>
        <p className="text-sm text-muted-foreground">You have been disconnected from the meeting.</p>
        <Button variant="outline" onClick={onLeave}>Return to Dashboard</Button>
      </div>
    );
  }

  const localIsSharing = isScreenShareEnabled;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-muted/20 shrink-0 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="font-semibold truncate text-sm sm:text-base">{meeting.title}</h1>
          <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground font-mono">
            <Hash className="w-3 h-3" />{meeting.meetingId}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <DurationClock running={isConnected} />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" /><span>{participants.length}</span>
          </div>
          {screenShareActive && (
            <Badge variant="outline" className="text-xs gap-1 bg-blue-500/10 text-blue-500">
              <Monitor className="w-3 h-3" />
              <span className="hidden sm:inline">Screen share</span>
            </Badge>
          )}
          <Badge variant="outline" className={`text-xs gap-1 ${connBadgeClass(connState)}`}>
            {connState === ConnectionState.Reconnecting
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Wifi className="w-3 h-3" />}
            <span className="hidden sm:inline">{connLabel(connState)}</span>
          </Badge>
        </div>
      </header>

      {/* Body: main stage + optional participant panel */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Main stage */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {screenShareActive && activeScreenShare ? (
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden bg-black">
              {/* Screen share primary stage — uses ScreenShareView which guards isMuted */}
              <div className="flex-1 min-h-0">
                <ScreenShareView
                  screenShareTrackRef={activeScreenShare}
                  sharerName={
                    resolveDisplayName(activeScreenShare.participant.name, activeScreenShare.participant.identity) +
                    (localIsSharing && activeScreenShare.participant.identity === localParticipant?.identity ? ' (You)' : '')
                  }
                  isLocalSharer={localIsSharing && activeScreenShare.participant.identity === localParticipant?.identity}
                  onStopShare={handleScreenShare}
                />
              </div>
              {/* Thumbnail sidebar */}
              <div className="shrink-0 h-32 md:h-auto md:w-64 lg:w-72 bg-zinc-950 flex md:flex-col gap-2 p-2 md:p-3 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto border-t md:border-t-0 md:border-l border-white/10 transition-all duration-300 ease-in-out">
                {participants.map((participant) => {
                  const isLocal = participant.identity === localParticipant?.identity;
                  return (
                    <div key={participant.identity} className="h-full md:h-auto w-40 md:w-full shrink-0">
                      <ThumbnailTile
                        participant={participant}
                        cameraRef={cameraByIdentity.get(participant.identity)}
                        micRef={micByIdentity.get(participant.identity)}
                        isLocal={isLocal}
                        localCameraEnabled={isLocal ? cameraEnabled : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-3 sm:p-4 bg-background/50">
              <VideoGrid
                participants={participants}
                localParticipant={localParticipant ?? undefined}
                cameraByIdentity={cameraByIdentity}
                micByIdentity={micByIdentity}
                localCameraEnabled={cameraEnabled}
              />
            </div>
          )}
        </div>

        {/* Participant panel (collapsible) */}
        {showPanel === 'participants' && (
          <ParticipantPanel
            participants={participants}
            localParticipant={localParticipant ?? undefined}
            hostUserId={hostUserId}
            micByIdentity={micByIdentity}
            cameraByIdentity={cameraByIdentity}
            screenShareByIdentity={screenShareByIdentity}
            onClose={() => setShowPanel(null)}
          />
        )}

        {/* Chat panel (collapsible) */}
        {showPanel === 'chat' && (
          <ChatPanel
            messages={chatMessages}
            localIdentity={localParticipant?.identity}
            onSend={sendChatMessage}
            isSending={chatSending}
            onClose={() => setShowPanel(null)}
          />
        )}

        {/* Whiteboard panel */}
        {showPanel === 'whiteboard' && (
          <WhiteboardPanel
            meetingId={meeting.meetingId}
            onClose={() => setShowPanel(null)}
            isHost={isHost}
            whiteboardLocked={whiteboardLocked}
            onToggleLock={toggleWhiteboardLock}
          />
        )}

        {/* Host controls panel — host only */}
        {showPanel === 'host' && isHost && (
          <HostControlsPanel
            participants={participants}
            localIdentity={localParticipant?.identity}
            isLocked={isLocked}
            removingIdentity={removingIdentity}
            endingMeeting={endingMeeting}
            onEndMeeting={handleEndMeeting}
            onRemoveParticipant={handleRemoveParticipant}
            onLockMeeting={handleLockMeeting}
            onClose={() => setShowPanel(null)}
          />
        )}
      </div>

      {/* Control bar */}
      <footer className="h-20 bg-muted/30 border-t flex items-center justify-center gap-3 sm:gap-4 px-4 shrink-0">
        <ControlButton active={micEnabled}
          activeIcon={<Mic className="w-5 h-5" />}
          inactiveIcon={<MicOff className="w-5 h-5" />}
          activeLabel="Mute" inactiveLabel="Unmute" onToggle={handleMic} disabled={micPending} />
        <ControlButton active={cameraEnabled}
          activeIcon={<Video className="w-5 h-5" />}
          inactiveIcon={<VideoOff className="w-5 h-5" />}
          activeLabel="Stop video" inactiveLabel="Start video" onToggle={handleCamera} disabled={cameraPending} />
        {isScreenShareEnabled ? (
          <div className="flex flex-col items-center gap-1">
            <Button
              variant="destructive"
              className="h-12 px-5 sm:px-6 rounded-full font-semibold shadow-lg gap-2 flex items-center justify-center transition-all"
              onClick={handleScreenShare}
              disabled={screenPending}
            >
              {screenPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <MonitorOff className="w-5 h-5" />}
              <span className="hidden sm:inline">Stop Sharing</span>
            </Button>
            <span className="text-[10px] text-destructive hidden sm:block font-medium">Presenting</span>
          </div>
        ) : (
          <ControlButton active={false}
            activeIcon={<MonitorOff className="w-5 h-5" />}
            inactiveIcon={<MonitorUp className="w-5 h-5" />}
            activeLabel="Stop share" inactiveLabel="Share screen"
            onToggle={handleScreenShare} disabled={screenPending} />
        )}
        <ControlButton active={showPanel === 'whiteboard'}
          activeIcon={<PenTool className="w-5 h-5" />}
          inactiveIcon={<PenTool className="w-5 h-5" />}
          activeLabel="Hide whiteboard" inactiveLabel="Whiteboard"
          onToggle={() => togglePanel('whiteboard')} highlight={showPanel === 'whiteboard'} />
        <ControlButton active={showPanel === 'participants'}
          activeIcon={<Users className="w-5 h-5" />}
          inactiveIcon={<Users className="w-5 h-5" />}
          activeLabel="Hide people" inactiveLabel="Show people"
          onToggle={() => togglePanel('participants')} highlight={showPanel === 'participants'} />
        {/* Chat button with unread badge */}
        <div className="flex flex-col items-center gap-1 relative">
          <div className="relative">
            <Button
              variant={showPanel === 'chat' ? 'default' : 'outline'}
              className={`w-12 h-12 rounded-full p-0 flex items-center justify-center transition-colors
                ${showPanel === 'chat' ? 'bg-blue-600 hover:bg-blue-700 text-white border-0' : ''}`}
              onClick={() => togglePanel('chat')}
              title={showPanel === 'chat' ? 'Hide chat' : 'Show chat'}
              aria-label={showPanel === 'chat' ? 'Hide chat' : 'Show chat'}
              aria-pressed={showPanel === 'chat'}
            >
              <MessageSquare className="w-5 h-5" />
            </Button>
            {unreadCount > 0 && showPanel !== 'chat' && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 cursor-pointer"
                onClick={() => { setUnreadCount(0); togglePanel('chat'); }}
                aria-label={`${unreadCount} unread messages, click to open chat`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setUnreadCount(0); togglePanel('chat'); } }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground hidden sm:block">
            {showPanel === 'chat' ? 'Hide chat' : 'Chat'}
          </span>
        </div>

        {/* Host controls button — host only */}
        {isHost && (
          <div className="flex flex-col items-center gap-1">
            <Button
              variant={showPanel === 'host' ? 'default' : 'outline'}
              className={`w-12 h-12 rounded-full p-0 flex items-center justify-center transition-colors
                ${showPanel === 'host' ? 'bg-rose-600 hover:bg-rose-700 text-white border-0' : ''}`}
              onClick={() => togglePanel('host')}
              title="Host controls"
              aria-label="Host controls"
              aria-pressed={showPanel === 'host'}
            >
              <ShieldAlert className="w-5 h-5" />
            </Button>
            <span className="text-[10px] text-muted-foreground hidden sm:block">Controls</span>
          </div>
        )}
        <Button variant="destructive" className="w-12 h-12 rounded-full p-0 flex items-center justify-center"
          onClick={onLeave} title="Leave meeting" aria-label="Leave meeting">
          <PhoneOff className="w-5 h-5" />
        </Button>
      </footer>    </div>
  );
}

// ─── Thumbnail tile (screen-share layout) ────────────────────────────────────

function ThumbnailTile({ participant, cameraRef, micRef, isLocal, localCameraEnabled }: {
  participant: Participant;
  cameraRef: TrackReferenceOrPlaceholder | undefined;
  micRef: TrackReferenceOrPlaceholder | undefined;
  isLocal: boolean;
  localCameraEnabled: boolean | undefined;
}) {
  const { name, identity } = useParticipantInfo({ participant });
  const isSpeaking         = useIsSpeaking(participant);
  const micMuted           = isMicMuted(micRef);
  const hasLiveCamera      = !!cameraRef && 'publication' in cameraRef && !!cameraRef.publication && !cameraRef.publication.isMuted;
  const showCamera         = isLocal ? (localCameraEnabled ?? false) && hasLiveCamera : hasLiveCamera;
  const label              = resolveDisplayName(name, identity);
  const abbr               = makeInitials(label);

  return (
    <div className={`relative bg-zinc-800 rounded-lg overflow-hidden flex items-center justify-center shrink-0 aspect-video h-full ring-2 transition-all duration-150 ${isSpeaking ? 'ring-emerald-400' : 'ring-transparent'}`}>
      {showCamera && cameraRef && 'publication' in cameraRef && cameraRef.publication ? (
        <VideoTrack trackRef={cameraRef} className="absolute inset-0 w-full h-full object-cover" style={{ objectFit: 'cover' }} />
      ) : (
        <Avatar className="w-10 h-10">
          <AvatarFallback className="bg-zinc-600 text-white text-sm font-semibold">
            {abbr || <VideoOff className="w-4 h-4 opacity-40" />}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 flex items-center justify-between bg-black/60">
        <span className="text-white text-[10px] font-medium truncate">{isLocal ? 'You' : label}</span>
        {micMuted && <MicOff className="w-2.5 h-2.5 text-red-400 shrink-0" />}
      </div>
    </div>
  );
}

// ─── Video grid ───────────────────────────────────────────────────────────────

function VideoGrid({ participants, localParticipant, cameraByIdentity, micByIdentity, localCameraEnabled }: {
  participants: Participant[];
  localParticipant: Participant | undefined;
  cameraByIdentity: Map<string, TrackReferenceOrPlaceholder>;
  micByIdentity: Map<string, TrackReferenceOrPlaceholder>;
  localCameraEnabled: boolean;
}) {
  const count = participants.length;
  const gridClass = count <= 1 ? 'grid-cols-1' : count === 2 ? 'grid-cols-1 sm:grid-cols-2' : count <= 4 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3';

  if (count === 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Waiting for participants…</div>;
  }

  return (
    <div className={`grid ${gridClass} gap-3 h-full auto-rows-fr`}>
      {participants.map((participant) => {
        const isLocal = participant.identity === localParticipant?.identity;
        return (
          <ParticipantTile key={participant.identity}
            participant={participant}
            cameraRef={cameraByIdentity.get(participant.identity)}
            micRef={micByIdentity.get(participant.identity)}
            isLocal={isLocal}
            localCameraEnabled={isLocal ? localCameraEnabled : undefined} />
        );
      })}
    </div>
  );
}

// ─── Participant tile ─────────────────────────────────────────────────────────

function ParticipantTile({ participant, cameraRef, micRef, isLocal, localCameraEnabled }: {
  participant: Participant;
  cameraRef: TrackReferenceOrPlaceholder | undefined;
  micRef: TrackReferenceOrPlaceholder | undefined;
  isLocal: boolean;
  localCameraEnabled: boolean | undefined;
}) {
  const { name, identity } = useParticipantInfo({ participant });
  const isSpeaking         = useIsSpeaking(participant);
  const micMuted           = isMicMuted(micRef);
  const hasLiveCamera      = !!cameraRef && 'publication' in cameraRef && !!cameraRef.publication && !cameraRef.publication.isMuted;
  const showCamera         = isLocal ? (localCameraEnabled ?? false) && hasLiveCamera : hasLiveCamera;
  const label              = resolveDisplayName(name, identity);
  const abbr               = makeInitials(label);

  return (
    <div className={`relative bg-zinc-900 rounded-xl overflow-hidden flex items-center justify-center aspect-video ring-2 transition-all duration-200 ${isSpeaking ? 'ring-emerald-400' : 'ring-transparent'}`}>
      {showCamera && cameraRef && 'publication' in cameraRef && cameraRef.publication ? (
        <VideoTrack trackRef={cameraRef} className="absolute inset-0 w-full h-full object-cover" style={{ objectFit: 'cover' }} />
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Avatar className="w-20 h-20 border-2 border-white/10">
            <AvatarFallback className="bg-zinc-700 text-white text-xl font-semibold">
              {abbr || <VideoOff className="w-8 h-8 opacity-40" />}
            </AvatarFallback>
          </Avatar>
          <span className="text-white/60 text-xs flex items-center gap-1.5"><VideoOff className="w-3 h-3" />Camera off</span>
        </div>
      )}
      {isSpeaking && <div className="absolute inset-0 rounded-xl ring-2 ring-emerald-400 pointer-events-none" />}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent">
        <span className="text-white text-xs font-medium truncate max-w-[75%]">{isLocal ? `${label} (You)` : label}</span>
        <span className={`flex items-center justify-center w-6 h-6 rounded-full ${micMuted ? 'bg-red-500/80' : 'bg-white/10'}`} title={micMuted ? 'Muted' : 'Mic on'}>
          {micMuted ? <MicOff className="w-3 h-3 text-white" /> : <Mic className="w-3 h-3 text-white/70" />}
        </span>
      </div>
    </div>
  );
}

// ─── Control button ───────────────────────────────────────────────────────────

function ControlButton({ active, activeIcon, inactiveIcon, activeLabel, inactiveLabel, onToggle, highlight, disabled }: {
  active: boolean;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  activeLabel: string;
  inactiveLabel: string;
  onToggle: () => void;
  highlight?: boolean;
  disabled?: boolean;
}) {
  const label = active ? activeLabel : inactiveLabel;
  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        variant={active ? (highlight ? 'default' : 'secondary') : 'outline'}
        className={`w-12 h-12 rounded-full p-0 flex items-center justify-center transition-colors
          ${active && highlight ? 'bg-blue-600 hover:bg-blue-700 text-white border-0' : ''}
          ${!active ? 'border-destructive text-destructive hover:bg-destructive/10' : ''}`}
        onClick={onToggle}
        disabled={disabled}
        title={label}
        aria-label={label}
        aria-pressed={active}
      >
        {disabled ? <Loader2 className="w-5 h-5 animate-spin" /> : (active ? activeIcon : inactiveIcon)}
      </Button>
      <span className="text-[10px] text-muted-foreground hidden sm:block">{label}</span>
    </div>
  );
}

// ─── Participant Panel ────────────────────────────────────────────────────────
// Collapsible sidebar. Rendered as a sibling of the main stage inside a flex row.
// Each PanelRow uses hooks directly since it's its own component (not in a .map callback).

function ParticipantPanel({
  participants,
  localParticipant,
  hostUserId,
  micByIdentity,
  cameraByIdentity,
  screenShareByIdentity,
  onClose,
}: {
  participants: Participant[];
  localParticipant: Participant | undefined;
  hostUserId: string | undefined;
  micByIdentity: Map<string, TrackReferenceOrPlaceholder>;
  cameraByIdentity: Map<string, TrackReferenceOrPlaceholder>;
  screenShareByIdentity: Map<string, true>;
  onClose: () => void;
}) {
  return (
    <aside
      className="
        w-full sm:w-72 shrink-0
        border-l bg-background flex flex-col
        fixed inset-y-0 right-0 z-30
        sm:static sm:inset-auto sm:z-auto
        overflow-hidden
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">
            People
            <span className="ml-1.5 text-muted-foreground font-normal">({participants.length})</span>
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close participants panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {participants.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">No participants yet</p>
        ) : (
          participants.map((participant) => (
            <PanelRow
              key={participant.identity}
              participant={participant}
              isLocal={participant.identity === localParticipant?.identity}
              isHost={!!hostUserId && participant.identity === hostUserId}
              micRef={micByIdentity.get(participant.identity)}
              cameraRef={cameraByIdentity.get(participant.identity)}
              isScreenSharing={screenShareByIdentity.has(participant.identity)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

// ─── Panel Row ────────────────────────────────────────────────────────────────
// One row per participant. Safe to call hooks here — own component, not a loop callback.

function PanelRow({
  participant,
  isLocal,
  isHost,
  micRef,
  cameraRef,
  isScreenSharing,
}: {
  participant: Participant;
  isLocal: boolean;
  isHost: boolean;
  micRef: TrackReferenceOrPlaceholder | undefined;
  cameraRef: TrackReferenceOrPlaceholder | undefined;
  isScreenSharing: boolean;
}) {
  const { name, identity } = useParticipantInfo({ participant });
  const isSpeaking         = useIsSpeaking(participant);

  const micMuted = isMicMuted(micRef);
  const cameraOff =
    !cameraRef ||
    !('publication' in cameraRef) ||
    !cameraRef.publication ||
    cameraRef.publication.isMuted;

  const label = resolveDisplayName(name, identity);
  const abbr  = makeInitials(label);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
      {/* Avatar with speaking ring */}
      <div className={`relative shrink-0 rounded-full p-0.5 transition-colors ${isSpeaking ? 'bg-emerald-400' : 'bg-transparent'}`}>
        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-muted text-foreground text-xs font-semibold">
            {abbr}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Name + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium truncate">
            {label}{isLocal ? ' (You)' : ''}
          </span>
          {isHost && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-500 bg-amber-500/10 rounded px-1 py-0.5 shrink-0">
              <Crown className="w-2.5 h-2.5" />Host
            </span>
          )}
        </div>
        {/* Status icons row */}
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`flex items-center gap-0.5 text-[10px] ${micMuted ? 'text-red-500' : 'text-muted-foreground'}`} title={micMuted ? 'Muted' : 'Mic on'}>
            {micMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
          </span>
          <span className={`flex items-center gap-0.5 text-[10px] ${cameraOff ? 'text-red-500' : 'text-muted-foreground'}`} title={cameraOff ? 'Camera off' : 'Camera on'}>
            {cameraOff ? <VideoOff className="w-3 h-3" /> : <Video className="w-3 h-3" />}
          </span>
          {isScreenSharing && (
            <span className="flex items-center gap-0.5 text-[10px] text-blue-500" title="Sharing screen">
              <Monitor className="w-3 h-3" />
            </span>
          )}
          {isSpeaking && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-500" title="Speaking">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────
// Receives messages and send function from RoomContent (which owns useChat).
// This keeps the hook at the correct level (inside LiveKitRoom, not in a panel).

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ChatPanel({
  messages,
  localIdentity,
  onSend,
  isSending,
  onClose,
}: {
  messages: ReceivedChatMessage[];
  localIdentity: string | undefined;
  onSend: (text: string) => Promise<ReceivedChatMessage>;
  isSending: boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [width, setWidth] = useState(320);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  
  const isDragging = useRef(false);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = document.body.clientWidth - e.clientX;
      if (newWidth >= 320 && newWidth <= 600) {
        setWidth(newWidth);
      }
    };
    
    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Focus input when panel opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft('');
    try {
      await onSend(text);
    } catch {
      toast.error('Failed to send message');
    }
  }, [draft, isSending, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <aside 
      style={!isMobile ? { width: `${width}px` } : undefined}
      className="
      w-full shrink-0
      border-l bg-background flex flex-col
      fixed inset-y-0 right-0 z-30
      sm:static sm:inset-auto sm:z-auto
      relative
    ">
      <div 
        className="hidden sm:block absolute top-0 bottom-0 left-0 w-1.5 -ml-[3px] cursor-col-resize hover:bg-primary z-40 transition-colors"
        onMouseDown={startDrag}
        title="Drag to resize"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Meeting Chat</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <MessageSquare className="w-8 h-8 opacity-20" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs opacity-60">Be the first to say something</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.from?.identity === localIdentity;
            const senderName = resolveDisplayName(msg.from?.name, msg.from?.identity);
            return (
              <div key={msg.id} className={`flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-baseline gap-1.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className="text-[11px] font-semibold text-muted-foreground truncate max-w-[120px]">
                    {isOwn ? 'You' : senderName}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words leading-relaxed
                  ${isOwn
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted text-foreground rounded-tl-sm'}`}>
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t px-3 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message… (Enter to send)"
            rows={2}
            className="
              flex-1 rounded-xl border bg-muted/40 px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring
              placeholder:text-muted-foreground/60
              min-h-[38px] max-h-36 overflow-y-auto
              resize-y
            "
            aria-label="Chat message"
          />
          <Button
            onClick={handleSend}
            disabled={!draft.trim() || isSending}
            className="w-9 h-9 rounded-full p-0 shrink-0 flex items-center justify-center"
            aria-label="Send message"
          >
            {isSending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-1 ml-1">
          Shift+Enter for new line
        </p>
      </div>
    </aside>
  );
}

// ─── Host Controls Panel ─────────────────────────────────────────────────────

function HostControlsPanel({
  participants,
  localIdentity,
  isLocked,
  removingIdentity,
  endingMeeting,
  onEndMeeting,
  onRemoveParticipant,
  onLockMeeting,
  onClose,
}: {
  participants: Participant[];
  localIdentity: string | undefined;
  isLocked: boolean;
  removingIdentity: string | null;
  endingMeeting: boolean;
  onEndMeeting: () => void;
  onRemoveParticipant: (identity: string, name: string) => void;
  onLockMeeting: () => void;
  onClose: () => void;
}) {
  return (
    <aside className="
      w-full sm:w-80 shrink-0
      border-l bg-background flex flex-col
      fixed inset-y-0 right-0 z-30
      sm:static sm:inset-auto sm:z-auto
      overflow-hidden
    ">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          <span className="font-semibold text-sm">Host Controls</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close host controls"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* Meeting actions */}
        <section className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Meeting
          </h4>

          {/* Lock */}
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-sm"
            onClick={onLockMeeting}
          >
            <Lock className="w-4 h-4" />
            {isLocked ? 'Unlock Meeting' : 'Lock Meeting'}
            {isLocked && (
              <span className="ml-auto text-[10px] font-semibold text-amber-500 bg-amber-500/10 rounded px-1 py-0.5">
                Locked
              </span>
            )}
          </Button>

          {/* End for everyone */}
          <Button
            variant="destructive"
            className="w-full justify-start gap-2 text-sm"
            onClick={onEndMeeting}
            disabled={endingMeeting}
          >
            {endingMeeting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <XCircle className="w-4 h-4" />}
            End Meeting for Everyone
          </Button>
        </section>

        {/* Participants */}
        <section className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Participants ({participants.length})
          </h4>

          {participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No participants</p>
          ) : (
            <div className="space-y-1">
              {participants.map((p) => {
                const isLocal = p.identity === localIdentity;
                const name    = resolveDisplayName(p.name, p.identity);
                const isRemoving = removingIdentity === p.identity;
                return (
                  <div
                    key={p.identity}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40"
                  >
                    <Avatar className="w-7 h-7 shrink-0">
                      <AvatarFallback className="bg-muted text-foreground text-[10px] font-semibold">
                        {makeInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-sm truncate">
                      {name}{isLocal ? ' (You)' : ''}
                    </span>
                    {!isLocal && (
                      <button
                        onClick={() => onRemoveParticipant(p.identity, name)}
                        disabled={!!isRemoving}
                        className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        title={`Remove ${name}`}
                        aria-label={`Remove ${name}`}
                      >
                        {isRemoving
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <UserMinus className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </aside>
  );
}


// ─── Whiteboard Panel ────────────────────────────────────────────────────────
// Collaborative whiteboard with undo/redo, auto-save, keyboard shortcuts,
// empty/loading states, and accessibility attributes.

const MAX_UNDO_STACK = 50;
const DRAW_THROTTLE_MS = 50;
const SAVE_DEBOUNCE_MS = 2000;

type DrawPoint = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  size: number;
  eraser: boolean;
};

type WbMessage =
  | { type: 'drawBatch'; points: DrawPoint[]; seq: number; sender: string }
  | { type: 'clear'; sender: string }
  | { type: 'lock'; locked: boolean; sender: string }
  | { type: 'snapshot'; dataUrl: string; sender: string };

function WhiteboardPanel({
  meetingId,
  onClose,
  isHost,
  whiteboardLocked,
  onToggleLock,
}: {
  meetingId: string;
  onClose: () => void;
  isHost: boolean;
  whiteboardLocked: boolean;
  onToggleLock: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { localParticipant } = useLocalParticipant();

  // ── Panel resize ────────────────────────────────────────────────────────
  const [panelWidth, setPanelWidth] = useState(400);
  const isDraggingPanel = useRef(false);

  const startPanelDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingPanel.current = true;
    document.body.style.cursor = 'col-resize';
    const onMove = (ev: MouseEvent) => {
      if (!isDraggingPanel.current) return;
      const w = document.body.clientWidth - ev.clientX;
      if (w >= 320 && w <= 900) setPanelWidth(w);
    };
    const onUp = () => {
      isDraggingPanel.current = false;
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // ── Tool state ──────────────────────────────────────────────────────────
  const [color, setColor] = useState('#000000'); // default pen color black
  const [brushSize, setBrushSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  // isLockedLocal is initialised from the prop once. After that it is owned by:
  //  a) handleToggleLock (local user toggles), b) applyMsg 'lock' (remote peer toggles).
  // The parent's whiteboardLocked prop is only used for the initial value — it doesn't
  // need to be re-synced because every mutation goes through the data channel anyway.
  const [isLockedLocal, setIsLockedLocal] = useState(whiteboardLocked);

  const canDraw = !isLockedLocal || isHost;

  // ── Undo / Redo stacks (ImageData snapshots) ────────────────────────────
  const undoStack = useRef<ImageData[]>([]);
  const redoStack = useRef<ImageData[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncStackState = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  /** Snapshot the current canvas onto the undo stack. Called before each stroke starts. */
  const pushUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStack.current.length > MAX_UNDO_STACK) undoStack.current.shift();
    redoStack.current = [];
    syncStackState();
  }, [syncStackState]);

  // ── Data channel ────────────────────────────────────────────────────────
  const seenSeqs = useRef<Set<number>>(new Set());

  const applyMsg = useCallback((data: WbMessage) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (data.type === 'drawBatch') {
      if (seenSeqs.current.has(data.seq)) return;
      seenSeqs.current.add(data.seq);
      data.points.forEach((pt) => {
        ctx.beginPath();
        ctx.moveTo(pt.from.x, pt.from.y);
        ctx.lineTo(pt.to.x, pt.to.y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (pt.eraser) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineWidth = pt.size * 3;
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = pt.color;
          ctx.lineWidth = pt.size;
        }
        ctx.stroke();
      });
    } else if (data.type === 'clear') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      undoStack.current = [];
      redoStack.current = [];
      syncStackState();
    } else if (data.type === 'lock') {
      if (typeof data.locked === 'boolean') setIsLockedLocal(data.locked);
    } else if (data.type === 'snapshot') {
      // Undo/redo sync: restore canvas to broadcast snapshot
      const dpr = window.devicePixelRatio || 1;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
      };
      img.src = data.dataUrl;
    }
  }, [syncStackState]);

  const { send: sendWb } = useDataChannel('whiteboard', (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload)) as WbMessage;
      if (data.sender === localParticipant?.identity) return; // echo guard
      applyMsg(data);
    } catch { /* malformed — ignore */ }
  });

  const broadcast = useCallback((payload: WbMessage) => {
    sendWb(new TextEncoder().encode(JSON.stringify(payload)), {});
  }, [sendWb]);

  // ── Persist — debounced auto-save ──────────────────────────────────────
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');
  // Store triggerSave in a ref so the retry toast can call the latest version
  // without creating a circular dependency in useCallback's dep array.
  const triggerSaveRef = useRef<() => void>(() => undefined);

  const triggerSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      if (dataUrl === lastSavedRef.current) return;
      setSaveState('saving');
      try {
        await meetingClientService.saveWhiteboard(meetingId, dataUrl);
        lastSavedRef.current = dataUrl;
        setSaveState('idle');
      } catch {
        setSaveState('error');
        toast.error('Whiteboard save failed — changes may be lost', {
          action: { label: 'Retry', onClick: () => triggerSaveRef.current() },
        });
      }
    }, SAVE_DEBOUNCE_MS);
  }, [meetingId]);

  // Keep triggerSaveRef current so the retry toast callback always invokes
  // the latest closure without adding triggerSave to its own dep array.
  useEffect(() => {
    triggerSaveRef.current = triggerSave;
  });

  // ── Load saved board on mount ───────────────────────────────────────────
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  // hasDrawnOnce drives the empty-state hint — declared here so the load callback can set it.
  const [hasDrawnOnce, setHasDrawnOnce] = useState(false);

  useEffect(() => {
    let cancelled = false;
    meetingClientService.loadWhiteboard(meetingId)
      .then((dataUrl) => {
        if (cancelled) return;
        if (!dataUrl) { setLoadState('ready'); return; }
        const canvas = canvasRef.current;
        if (!canvas) { setLoadState('ready'); return; }
        const ctx = canvas.getContext('2d');
        if (!ctx) { setLoadState('ready'); return; }
        const img = new Image();
        img.onload = () => {
          if (!cancelled) {
            const dpr = window.devicePixelRatio || 1;
            ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
            lastSavedRef.current = dataUrl;
            setHasDrawnOnce(true);
            setLoadState('ready');
          }
        };
        img.onerror = () => { if (!cancelled) setLoadState('ready'); };
        img.src = dataUrl;
      })
      .catch(() => { if (!cancelled) { setLoadState('error'); } });
    return () => { cancelled = true; };
  }, [meetingId]);

  // ── Drawing ─────────────────────────────────────────────────────────────
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const drawBuffer = useRef<DrawPoint[]>([]);

  // Flush draw buffer to peers at fixed interval
  useEffect(() => {
    const id = setInterval(() => {
      if (drawBuffer.current.length === 0) return;
      const points = drawBuffer.current.splice(0);
      broadcast({ type: 'drawBatch', points, seq: Date.now(), sender: localParticipant?.identity ?? '' });
    }, DRAW_THROTTLE_MS);
    return () => clearInterval(id);
  }, [broadcast, localParticipant?.identity]);

  // Abort drawing when pointer leaves window
  useEffect(() => {
    const abort = () => { isDrawing.current = false; lastPos.current = null; };
    window.addEventListener('pointerup', abort);
    window.addEventListener('pointercancel', abort);
    return () => {
      window.removeEventListener('pointerup', abort);
      window.removeEventListener('pointercancel', abort);
    };
  }, []);

  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    pushUndo(); // snapshot before stroke so undo restores pre-stroke state
    isDrawing.current = true;
    if (!hasDrawnOnce) setHasDrawnOnce(true);
    lastPos.current = getCoords(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !lastPos.current || !canDraw) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cur = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(cur.x, cur.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = brushSize * 3;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
    }
    ctx.stroke();
    drawBuffer.current.push({ from: lastPos.current, to: cur, color, size: brushSize, eraser: isEraser });
    lastPos.current = cur;
  };

  const handlePointerUp = () => {
    isDrawing.current = false;
    lastPos.current = null;
    triggerSave();
  };

  // ── Undo ────────────────────────────────────────────────────────────────
  const performUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || undoStack.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    redoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(undoStack.current.pop()!, 0, 0);
    syncStackState();
    const dataUrl = canvas.toDataURL('image/png');
    broadcast({ type: 'snapshot', dataUrl, sender: localParticipant?.identity ?? '' });
    triggerSave();
  }, [syncStackState, broadcast, localParticipant?.identity, triggerSave]);

  // ── Redo ────────────────────────────────────────────────────────────────
  const performRedo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || redoStack.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(redoStack.current.pop()!, 0, 0);
    syncStackState();
    const dataUrl = canvas.toDataURL('image/png');
    broadcast({ type: 'snapshot', dataUrl, sender: localParticipant?.identity ?? '' });
    triggerSave();
  }, [syncStackState, broadcast, localParticipant?.identity, triggerSave]);

  // ── Clear canvas (host only) ────────────────────────────────────────────
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    pushUndo();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    undoStack.current = [];
    redoStack.current = [];
    syncStackState();
    broadcast({ type: 'clear', sender: localParticipant?.identity ?? '' });
    triggerSave();
  }, [pushUndo, syncStackState, broadcast, localParticipant?.identity, triggerSave]);

  // ── Lock toggle (host only) ─────────────────────────────────────────────
  const handleToggleLock = useCallback(() => {
    const next = !isLockedLocal;
    setIsLockedLocal(next);
    onToggleLock();
    broadcast({ type: 'lock', locked: next, sender: localParticipant?.identity ?? '' });
  }, [isLockedLocal, onToggleLock, broadcast, localParticipant?.identity]);

  // ── Canvas resize — preserve content and allow scrolling ────────────────────────
  const CANVAS_SIZE = 2000; // Fixed large canvas for scrolling
  const isFirstMount = useRef(true);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Snapshot existing pixels before resizing (avoid expensive toDataURL)
    let prevImageData: ImageData | null = null;
    const wasAlreadySetup = !isFirstMount.current;
    if (wasAlreadySetup && canvas.width > 0 && canvas.height > 0) {
      try {
        prevImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch { /* cross-origin / security error — skip restore */ }
    }
    isFirstMount.current = false;

    const dpr = window.devicePixelRatio || 1;
    // Set a fixed large logical size, then scale for device pixel ratio
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    canvas.style.width = `${CANVAS_SIZE}px`;
    canvas.style.height = `${CANVAS_SIZE}px`;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Restore previous drawing if any — putImageData is synchronous and cheap
    if (prevImageData) {
      ctx.putImageData(prevImageData, 0, 0);
    }
  }, [panelWidth]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === 'z' && !e.shiftKey) { e.preventDefault(); performUndo(); }
      else if (meta && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); performRedo(); }
      else if (!meta && e.key === 'e') setIsEraser(true);
      else if (!meta && e.key === 'p') setIsEraser(false);
      else if (!meta && e.key === 'Delete' && isHost) clearCanvas();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [performUndo, performRedo, clearCanvas, isHost]);

// ── Cleanup ─────────────────────────────────────────────────────────────
useEffect(() => {
  return () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    document.body.style.cursor = '';
    if (saveState !== 'saving') {
      triggerSave();
    }
  };
}, [triggerSave, saveState]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <aside
      style={!isMobile ? { width: `${panelWidth}px` } : undefined}
      className="w-full shrink-0 border-l bg-background flex flex-col fixed inset-y-0 right-0 z-30 sm:static sm:inset-auto sm:z-auto relative"
      aria-label="Whiteboard panel"
    >
      {/* Resize handle — desktop only */}
      <div
        className="hidden sm:block absolute top-0 bottom-0 left-0 w-1.5 -ml-[3px] cursor-col-resize hover:bg-primary/50 z-40 transition-colors"
        onMouseDown={startPanelDrag}
        aria-hidden="true"
        title="Drag to resize"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <PenTool className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="font-semibold text-sm">Whiteboard</span>
          {isLockedLocal && !isHost && (
            <span className="text-[10px] text-amber-500 bg-amber-500/10 rounded px-1.5 py-0.5 font-semibold shrink-0">
              Locked
            </span>
          )}
          {saveState === 'saving' && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              Saving…
            </span>
          )}
          {saveState === 'error' && (
            <span className="text-[10px] text-destructive shrink-0">Unsaved</span>
          )}

           {/* Host-only: lock + clear */}
        {isHost && (
          <>
            <div className="w-px h-6 bg-border" aria-hidden="true" />
            <Button
              variant={isLockedLocal ? 'default' : 'outline'} size="sm"
              onClick={handleToggleLock}
              className="h-8 w-8 p-0"
              aria-label={isLockedLocal ? 'Unlock whiteboard' : 'Lock whiteboard for participants'}
              aria-pressed={isLockedLocal}
              title={isLockedLocal ? 'Unlock whiteboard' : 'Lock whiteboard'}
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline" size="sm" onClick={clearCanvas}
              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
              aria-label="Clear whiteboard (Delete key)" title="Clear whiteboard (Delete)">
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </Button>
          </>
        )}
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close whiteboard"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label="Whiteboard tools"
        className="flex items-center gap-1.5 px-3 py-2 border-b shrink-0 bg-muted/20 flex-wrap"
      >
        {/* Undo */}
        <Button variant="outline" size="sm" onClick={performUndo} disabled={!canUndo}
          className="h-8 w-8 p-0" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)">
          <Undo2 className="w-4 h-4" aria-hidden="true" />
        </Button>

        {/* Redo */}
        <Button variant="outline" size="sm" onClick={performRedo} disabled={!canRedo}
          className="h-8 w-8 p-0" aria-label="Redo (Ctrl+Y)" title="Redo (Ctrl+Y)">
          <Redo2 className="w-4 h-4" aria-hidden="true" />
        </Button>

        <div className="w-px h-6 bg-border" aria-hidden="true" />

        {/* Pen */}
        <Button variant={!isEraser ? 'default' : 'outline'} size="sm"
          onClick={() => setIsEraser(false)}
          className="h-8 w-8 p-0" aria-label="Pen (P)" aria-pressed={!isEraser} title="Pen (P)">
          <PenTool className="w-4 h-4" aria-hidden="true" />
        </Button>

        {/* Eraser */}
        <Button variant={isEraser ? 'default' : 'outline'} size="sm"
          onClick={() => setIsEraser(true)}
          className="h-8 w-8 p-0" aria-label="Eraser (E)" aria-pressed={isEraser} title="Eraser (E)">
          <Eraser className="w-4 h-4" aria-hidden="true" />
        </Button>

        <div className="w-px h-6 bg-border" aria-hidden="true" />

        {/* Color — accessible label wraps the native input */}
        <label title="Stroke colour" aria-label="Stroke colour" className="cursor-pointer">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            disabled={isEraser} className="sr-only" />
          <span
            className="block w-7 h-7 rounded border-2 border-border hover:border-primary transition-colors"
            style={{ backgroundColor: isEraser ? 'transparent' : color }}
            aria-hidden="true"
          />
        </label>

        {/* Brush size + live preview dot */}
        <div className="flex items-center gap-1.5 min-w-[90px] flex-1">
          <span className="text-[10px] text-muted-foreground tabular-nums w-6">{brushSize}px</span>
          <input type="range" min="1" max="20" value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="flex-1 cursor-pointer accent-primary"
            aria-label={`Brush size: ${brushSize} pixels`} title="Brush size" />
          <span
            className="rounded-full shrink-0 transition-all"
            style={{
              width: `${Math.max(4, brushSize)}px`,
              height: `${Math.max(4, brushSize)}px`,
              backgroundColor: isEraser ? 'var(--muted-foreground)' : color,
            }}
            aria-hidden="true"
          />
        </div>


      </div>

      {/* Canvas container */}
      <div className="flex-1 relative overflow-auto bg-white touch-none" style={{ overflow: 'auto' }}>

        {/* Loading overlay */}
        {loadState === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-10" aria-live="polite">
            <div className="flex flex-col items-center gap-2 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
              <span className="text-xs">Restoring board…</span>
            </div>
          </div>
        )}

        {/* Load-error state */}
        {loadState === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 z-10 p-4" aria-live="assertive">
            <div className="flex flex-col items-center gap-3 text-center max-w-xs">
              <span className="text-xs text-zinc-400">Could not load the saved board. You can still draw — changes will save automatically.</span>
              <Button variant="outline" size="sm" onClick={() => setLoadState('ready')}>Continue anyway</Button>
            </div>
          </div>
        )}

        {/* Empty-state hint */}
        {loadState === 'ready' && !canUndo && !hasDrawnOnce && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" aria-hidden="true">
            <div className="flex flex-col items-center gap-1 text-zinc-600">
              <PenTool className="w-8 h-8 opacity-25" />
              <span className="text-xs opacity-50">
                {canDraw ? 'Start drawing…' : 'Board is locked by the host'}
              </span>
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className={`absolute inset-0 w-full h-full ${canDraw ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
          role="img"
          aria-label="Whiteboard canvas — draw with your pointer"
        />
      </div>
    </aside>
  );
}
