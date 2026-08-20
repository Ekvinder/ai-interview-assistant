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
  useRoomContext,
} from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder, ReceivedChatMessage } from '@livekit/components-react';
import { ConnectionState, Track, Participant , RoomEvent} from 'livekit-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { roomOptions } from '@/lib/livekit-client-options';
import WhiteboardPanel from './components/WhiteboardPanel';
import HostBreakoutPanel from './components/HostBreakoutPanel';
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
  Layers,
} from 'lucide-react';
import { getLiveKitToken } from '@/lib/api';
import { meetingClientService } from '@/services/client/meeting.service';
import { toast } from 'sonner';
import ScreenShareView from './components/ScreenShareView';
import { useBreakoutTransition } from '@/hooks/useBreakoutTransition';
import { useWhiteboardSync } from '@/hooks/useWhiteboardSync';
import { normalizeElements, denormalizeElements } from '@/utils/annotationCoordinates';

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

// ─── Breakout Room Transition Helper ──────────────────────────────────────────
//
// Disconnects the current LiveKit room when a breakout switch is triggered, then
// calls onDisconnectComplete so MeetingRoom can clear the token and fetch a new one.
//
// Guards:
// - hasDisconnectedRef prevents a second disconnect if the parent re-renders
//   while isSwitching is still true (which would re-run the effect because
//   onDisconnectComplete is an inline arrow and always a new reference).
// - onBeforeDisconnect is called synchronously before room.disconnect() so the
//   parent can set isSwitchingRef.current = true before LiveKit fires onDisconnected,
//   preventing handleLeave from navigating away during an intentional switch.
// - The effect tracks the specific `isSwitching=true` epoch by resetting the
//   guard when isSwitching flips back to false.

function RoomTransitionHandler({
  isSwitching,
  onBeforeDisconnect,
  onDisconnectComplete,
}: {
  isSwitching: boolean;
  onBeforeDisconnect: () => void;
  onDisconnectComplete: () => void;
}) {
  const room = useRoomContext();

  // Stable refs to callbacks — avoids the effect re-running when inline arrows
  // in MeetingRoom's JSX create new function references on every render.
  const onBeforeDisconnectRef = useRef(onBeforeDisconnect);
  const onDisconnectCompleteRef = useRef(onDisconnectComplete);
  useEffect(() => { onBeforeDisconnectRef.current = onBeforeDisconnect; });
  useEffect(() => { onDisconnectCompleteRef.current = onDisconnectComplete; });

  // Guards against calling disconnect() more than once per switch epoch.
  const hasDisconnectedRef = useRef(false);

  useEffect(() => {
    if (!isSwitching) {
      // Reset the guard when the switch completes so the next switch works.
      hasDisconnectedRef.current = false;
      return;
    }
    if (hasDisconnectedRef.current) return; // already handling this epoch
    if (!room) return;

    hasDisconnectedRef.current = true;

    // CRITICAL: call onBeforeDisconnect synchronously BEFORE room.disconnect().
    // LiveKit fires the room's onDisconnected event during disconnect(), and
    // MeetingRoom's handleLeave reads isSwitchingRef to decide whether to
    // navigate away. If we don't set the ref first, handleLeave runs and
    // redirects the user to /dashboard, destroying the transition.
    onBeforeDisconnectRef.current();

    room.disconnect()
      .then(() => onDisconnectCompleteRef.current())
      .catch((err) => {
        console.error('[RoomTransitionHandler] disconnect error:', err);
        onDisconnectCompleteRef.current();
      });

  // Callback refs are intentionally excluded — we read them via ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSwitching, room]);

  return null;
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
  const [joinStatus, setJoinStatus] = useState<'pending' | 'approved' | 'denied'>(
    (userId && userId === hostUserId) ? 'approved' : 'pending',
  );
  const [loading, setLoading] = useState(true);
  const leftRef        = useRef(false);
  const isSwitchingRef = useRef(false);
  const isHost = userId === hostUserId;

  const {
    targetBreakoutId,
    setTargetBreakoutId,
    isSwitchingRooms,
    setIsSwitchingRooms,
    readyForTokenSwitch,
    setReadyForTokenSwitch,
    initialCheckComplete,
  } = useBreakoutTransition(meeting.meetingId, userId, joinStatus);

  // Keep isSwitchingRef synchronised with isSwitchingRooms.
  // We update it both via useEffect (for async correctness) AND inline below
  // whenever we call setIsSwitchingRooms, so that onDisconnected — which fires
  // synchronously during room.disconnect() — always reads the current value.
  useEffect(() => { isSwitchingRef.current = isSwitchingRooms; }, [isSwitchingRooms]);

  // ── Guest admission ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isHost) {
      setLoading(false); // host skips admission — handled by token-fetch effect
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        sessionStorage.removeItem(MEETING_TOKEN_KEY);
        const gId = !userId ? (sessionStorage.getItem('meetspace_guest_id') || undefined) : undefined;
        const gName = !userId ? (sessionStorage.getItem('meetspace_guest_name') || undefined) : undefined;
        
        await meetingClientService.joinMeeting(meeting.meetingId, gId, gName);
        const status = await meetingClientService.getJoinRequestStatus(meeting.meetingId, gId);
        if (!cancelled) setJoinStatus(status);
      } catch (err) {
        if (!cancelled) setTokenError((err as Error).message || 'Failed to request admission');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isHost, meeting.meetingId, userId]);

  // ── Guest approval polling ─────────────────────────────────────────────────
  useEffect(() => {
    if (isHost || joinStatus !== 'pending') return;
    let delay = 2000;
    let timerId: ReturnType<typeof setTimeout>;
    let active = true;
    const gId = !userId ? (sessionStorage.getItem('meetspace_guest_id') || undefined) : undefined;
    
    const poll = async () => {
      try {
        const status = await meetingClientService.getJoinRequestStatus(meeting.meetingId, gId);
        if (!active) return;
        setJoinStatus(status);
        if (status !== 'pending') return;
      } catch { /* transient */ }
      delay = Math.min(delay * 1.5, 10_000);
      timerId = setTimeout(poll, delay);
    };
    timerId = setTimeout(poll, delay);
    return () => { active = false; clearTimeout(timerId); };
  }, [isHost, joinStatus, meeting.meetingId, userId]);

  // ── Token fetch ────────────────────────────────────────────────────────────
  // Runs when:
  //   • joinStatus first becomes 'approved'
  //   • initialCheckComplete flips to true (breakout pre-check done)
  //   • A breakout room switch completes (readyForTokenSwitch becomes true)
  // Does NOT run when:
  //   • isSwitchingRooms is true but readyForTokenSwitch is false
  //     (LiveKit is still disconnecting — wait for RoomTransitionHandler)
  useEffect(() => {
    if (joinStatus !== 'approved') return;
    if (!initialCheckComplete) return;
    if (isSwitchingRooms && !readyForTokenSwitch) return;

    let cancelled = false;
    setLoading(true);
    setTokenError(null);

    (async () => {
      try {
        const gId = !userId ? (sessionStorage.getItem('meetspace_guest_id') || undefined) : undefined;
        const gName = !userId ? (sessionStorage.getItem('meetspace_guest_name') || undefined) : undefined;
        const finalUserId = userId || gId || 'unknown';
        const finalUserName = userName || gName || 'Guest';
        
        const { token: t, url: u } = await getLiveKitToken(
          meeting.meetingId,
          finalUserId,
          {
            name: finalUserName,
            metadata: JSON.stringify({ userId: finalUserId, email: userEmail, name: finalUserName }),
            breakoutRoomId: targetBreakoutId || undefined,
          },
        );
        if (!cancelled) {
          setToken(t);
          setServerUrl(u);
          isSwitchingRef.current = false; // reset synchronously so next switch works immediately
          setIsSwitchingRooms(false);
          setReadyForTokenSwitch(false);
        }
      } catch (err) {
        if (!cancelled) {
          if (targetBreakoutId) {
            toast.error('Breakout room unavailable. Returning to main meeting.');
            isSwitchingRef.current = true; // set synchronously before any disconnect fires
            setTargetBreakoutId(null);
            setIsSwitchingRooms(true);
            setReadyForTokenSwitch(true);
          } else {
            setTokenError((err as Error).message || 'Failed to get meeting token');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // setTargetBreakoutId, setIsSwitchingRooms, setReadyForTokenSwitch are all
  // stable (useCallback / useState setters) — safe to omit from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    joinStatus,
    initialCheckComplete,
    // Re-fetch when the user is switched to/from a breakout room.
    targetBreakoutId,
    readyForTokenSwitch,
    // Stable identity fields — only change if the meeting itself changes.
    meeting.meetingId,
    userId,
    userName,
    userEmail,
  ]);

  // ── Leave / cleanup ────────────────────────────────────────────────────────
  const handleLeave = useCallback(() => {
    if (leftRef.current || isSwitchingRef.current) return;
    leftRef.current = true;
    sessionStorage.removeItem(MEETING_TOKEN_KEY);
    const gId = !userId ? (sessionStorage.getItem('meetspace_guest_id') || undefined) : undefined;
    void meetingClientService.leaveMeeting(meeting.meetingId, gId).catch(() => undefined);
    router.replace('/dashboard');
  }, [meeting.meetingId, router, userId]);

  useEffect(() => {
    const h = () => {
      sessionStorage.removeItem(MEETING_TOKEN_KEY);
      const gId = !userId ? (sessionStorage.getItem('meetspace_guest_id') || undefined) : undefined;
      const body = gId ? JSON.stringify({ guestId: gId }) : '';
      navigator.sendBeacon(`/api/meetings/${meeting.meetingId}/leave`, body);
    };
    window.addEventListener('pagehide', h);
    return () => window.removeEventListener('pagehide', h);
  }, [meeting.meetingId, userId]);

  // ── Render ─────────────────────────────────────────────────────────────────

  // Show spinner while we are: loading the token OR waiting for breakout init.
  // Do not show it when isSwitchingRooms is true — that has its own overlay.
  if ((loading || !initialCheckComplete) && !isSwitchingRooms) {
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
        <p className="text-sm text-muted-foreground max-w-sm">
          Your join request was sent. Your camera and microphone will not connect until the host allows you in.
        </p>
        <Button variant="outline" onClick={handleLeave}>Leave waiting room</Button>
      </div>
    );
  }

  if (joinStatus === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
        <XCircle className="w-10 h-10 text-destructive opacity-70" />
        <h2 className="font-semibold text-lg">Join request denied</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          The host did not allow you to join this meeting.
        </p>
        <Button variant="outline" onClick={handleLeave}>Back to Dashboard</Button>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
        <WifiOff className="w-10 h-10 text-destructive opacity-60" />
        <h2 className="font-semibold text-lg">Unable to join</h2>
        <p className="text-sm text-muted-foreground max-w-sm">{tokenError}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
          <Button onClick={() => { leftRef.current = false; setTokenError(null); setLoading(true); }}>
            <RefreshCw className="w-4 h-4 mr-2" />Retry
          </Button>
        </div>
      </div>
    );
  }

  // While a breakout room switch is in progress we keep the LiveKitRoom mounted
  // (so RoomTransitionHandler can call room.disconnect()) but show a full-screen
  // overlay. We only hide the LiveKitRoom after the token is cleared.
  if (!token || !serverUrl) {
    // This state is transient — the token-fetch effect will run momentarily.
    // Show the switching overlay if that is the reason, otherwise the spinner.
    return isSwitchingRooms ? (
      <div className="relative flex flex-col flex-1">
        <div className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
          <p className="text-sm font-medium">
            {targetBreakoutId ? 'Joining Breakout Room…' : 'Returning to Main Room…'}
          </p>
        </div>
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Connecting to meeting…</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col flex-1 overflow-hidden">
      {isSwitchingRooms && (
        <div className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
          <p className="text-sm font-medium">
            {targetBreakoutId ? 'Joining Breakout Room…' : 'Returning to Main Room…'}
          </p>
        </div>
      )}
      <LiveKitRoom
        options={roomOptions}
        token={token}
        serverUrl={serverUrl}
        connect
        audio={false}
        video={false}
        onDisconnected={() => {
          // During an intentional breakout switch, RoomTransitionHandler calls
          // room.disconnect() which fires onDisconnected. We must not treat this
          // as a user leaving the meeting. isSwitchingRef is set synchronously
          // in onBeforeDisconnect before room.disconnect() is called.
          if (isSwitchingRef.current) return;
          handleLeave();
        }}
        onError={(err) => {
          // Device permission errors are not meeting errors.
          if (err.name === 'NotAllowedError' || err.message?.toLowerCase().includes('permission')) {
            console.warn('[LiveKit] Device permission denied:', err.message);
            return;
          }
          // During an intentional room switch, LiveKit may emit connection-closed
          // errors as the room tears down. Suppress them — they are expected.
          if (isSwitchingRef.current) {
            console.debug('[LiveKit] Expected error during room switch:', err.message);
            return;
          }
          console.error('[LiveKit Meeting]', err);
          toast.error('Connection error: ' + err.message);
        }}
        style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
      >
        <RoomTransitionHandler
          isSwitching={isSwitchingRooms}
          onBeforeDisconnect={() => {
            // Set the ref synchronously so handleLeave sees it before LiveKit
            // fires onDisconnected during the room.disconnect() call below.
            isSwitchingRef.current = true;
          }}
          onDisconnectComplete={() => {
            setReadyForTokenSwitch(true);
            setToken(null);     // clears token so LiveKitRoom unmounts cleanly
            setServerUrl(null); // prevents stale URL from being reused
          }}
        />
        <RoomAudioRenderer />
        <RoomContent meeting={meeting} onLeave={handleLeave} hostUserId={hostUserId} userId={userId} />
      </LiveKitRoom>
    </div>
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

  // Panel state: 'participants' | 'chat' | 'host' | 'whiteboard' | 'breakout' | null
  const [showPanel, setShowPanel] = useState<'participants' | 'chat' | 'host' | 'whiteboard' | 'breakout' | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  // Ref mirrors showPanel so the unread effect always reads the current value
  const showPanelRef = useRef<'participants' | 'chat' | 'host' | 'whiteboard' | 'breakout' | null>(null);

  const togglePanel = useCallback((panel: 'participants' | 'chat' | 'host' | 'whiteboard' | 'breakout') => {
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
        description: showPanelRef.current !== 'chat' ? 'Click to open chat' : undefined,
        action: showPanelRef.current !== 'chat' ? {
          label: 'Open',
          onClick: () => togglePanel('chat')
        } : undefined,
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

  // ── Whiteboard sync & host-controlled permissions ─────────────────────────────────
  // One useWhiteboardSync instance per room provides DataChannel sync, scene state,
  // visibility broadcast (host), and permission management (host).

  // Ref that stays current with hostWhiteboardOpen — passed to useWhiteboardSync
  // so it can include the value in full-sync responses to late joiners.
  const hostWhiteboardOpenRef = useRef(false);
  const hostAnnotationActiveRef = useRef(false);

  const whiteboardStageSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  const {
    handleLocalChange: whiteboardHandleLocalChange,
    excalidrawApiRef: whiteboardExcalidrawApiRef,
    whiteboardOpen: whiteboardOpenFromSync,
    controllers: whiteboardControllers,
    broadcastVisibility: whiteboardBroadcastVisibility,
    broadcastPermissions: whiteboardBroadcastPermissions,
    syncControllersRef: whiteboardSyncControllersRef,
    requestResync: whiteboardRequestResync,
  } = useWhiteboardSync(hostUserId, isHost, "whiteboard", hostWhiteboardOpenRef, hostAnnotationActiveRef, whiteboardStageSizeRef);

  const handleWhiteboardStageSize = useCallback(
    (size: { width: number; height: number }) => {
      const oldSize = whiteboardStageSizeRef.current;
      whiteboardStageSizeRef.current = size;

      if (
        oldSize.width > 0 && oldSize.height > 0 &&
        size.width > 0 && size.height > 0 &&
        (oldSize.width !== size.width || oldSize.height !== size.height)
      ) {
        const api = whiteboardExcalidrawApiRef.current;
        if (api) {
          const elements = api.getSceneElements();
          if (elements.length > 0) {
            const logical = normalizeElements(elements as unknown as Record<string, unknown>[], oldSize);
            const scaled = denormalizeElements(logical, size);
            api.updateScene({ elements: scaled as any, captureUpdate: "NEVER" });
          }
        }
      }
    },
    [whiteboardExcalidrawApiRef]
  );

  const annotationStageSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  const {
    handleLocalChange: annotationHandleLocalChange,
    excalidrawApiRef: annotationExcalidrawApiRef,
    annotationActive: annotationActiveFromSync,
    broadcastAnnotationState,
    requestResync: annotationRequestResync,
  } = useWhiteboardSync(hostUserId, isHost, "annotation", hostWhiteboardOpenRef, hostAnnotationActiveRef, annotationStageSizeRef);

  const handleAnnotationStageSize = useCallback(
    (size: { width: number; height: number }) => {
      const oldSize = annotationStageSizeRef.current;
      annotationStageSizeRef.current = size;

      if (
        oldSize.width > 0 && oldSize.height > 0 &&
        size.width > 0 && size.height > 0 &&
        (oldSize.width !== size.width || oldSize.height !== size.height)
      ) {
        const api = annotationExcalidrawApiRef.current;
        if (api) {
          const elements = api.getSceneElements();
          if (elements.length > 0) {
            const logical = normalizeElements(elements as unknown as Record<string, unknown>[], oldSize);
            const scaled = denormalizeElements(logical, size);
            api.updateScene({ elements: scaled as any, captureUpdate: "NEVER" });
          }
        }
      }
    },
    [annotationExcalidrawApiRef]
  );

  // Host manages whiteboardOpen locally and broadcasts it.
  // Participants use whiteboardOpenFromSync (received from host via DataChannel).
  const [hostWhiteboardOpen, setHostWhiteboardOpen] = useState(false);
  const whiteboardOpen = isHost ? hostWhiteboardOpen : whiteboardOpenFromSync;

  const [hostAnnotationActive, setHostAnnotationActive] = useState(false);
  const annotationActive = isHost ? hostAnnotationActive : annotationActiveFromSync;

  // Keep the ref current so late-joiner full-sync responses include the right state.
  useEffect(() => {
    hostWhiteboardOpenRef.current = hostWhiteboardOpen;
  }, [hostWhiteboardOpen]);

  useEffect(() => {
    hostAnnotationActiveRef.current = hostAnnotationActive;
  }, [hostAnnotationActive]);

  // Host manages the controllers set locally and broadcasts it.
  // Participants use whiteboardControllers (received from host via DataChannel).
  const [hostControllersArray, setHostControllersArray] = useState<string[]>([]);
  const hostControllersSet = useMemo(() => new Set(hostControllersArray), [hostControllersArray]);
  const controllers = isHost ? hostControllersSet : whiteboardControllers;

  // Host: broadcast visibility only when the host explicitly changes it (skip mount).
  // Broadcasting false on mount would reset any state participants already received
  // from a prior full-sync, and sendRef may not be ready at mount time anyway.
  const hostWhiteboardOpenMountedRef = useRef(false);
  useEffect(() => {
    if (!isHost) return;
    if (!hostWhiteboardOpenMountedRef.current) {
      hostWhiteboardOpenMountedRef.current = true;
      return; // skip the initial mount run
    }
    whiteboardBroadcastVisibility(hostWhiteboardOpen);
  }, [isHost, hostWhiteboardOpen, whiteboardBroadcastVisibility]);

  // Host: keep the hook's internal controllers ref in sync and broadcast
  // whenever the controllers array changes.
  const didMountPermissionsRef = useRef(false);
  useEffect(() => {
    if (!isHost) return;
    // Always sync the ref so request-sync responses carry the current list.
    whiteboardSyncControllersRef(hostControllersArray);
    // Skip broadcast on initial mount — no participants to notify yet.
    if (!didMountPermissionsRef.current) { didMountPermissionsRef.current = true; return; }
    whiteboardBroadcastPermissions(hostControllersArray);
  }, [isHost, hostControllersArray, whiteboardBroadcastPermissions, whiteboardSyncControllersRef]);

  // Participant: auto-open/close whiteboard panel driven by host broadcasts.
  // When the panel transitions to open, trigger a resync so the freshly-mounted
  // Excalidraw instance receives the current scene immediately.
  // Skip during screen-share — the sidebar whiteboard is hidden during screen-share
  // (!screenShareActive guard on render), so opening it causes unnecessary re-renders.
  const prevWhiteboardOpenRef = useRef(false);
  // Ref so the effect below can read screenShareActive without capturing a stale closure
  // (screenShareActive is declared later in this component after the useTracks calls).
  const screenShareActiveRef2 = useRef(false);
  useEffect(() => {
    if (isHost) return;
    const prev = prevWhiteboardOpenRef.current;
    prevWhiteboardOpenRef.current = whiteboardOpen;
    if (whiteboardOpen && !prev) {
      setShowPanel('whiteboard');
      setTimeout(() => whiteboardRequestResync(), 200);
    } else if (!whiteboardOpen && prev && showPanel === 'whiteboard') {
      setShowPanel(null);
    }
  // showPanel excluded — we only react to whiteboardOpen transitions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, whiteboardOpen]);

  // Host: grant drawing permission to a participant.
  const hostGiveWhiteboardControl = useCallback((identity: string) => {
    if (!isHost) return;
    // console.log("[WB PERMISSION CLICK]", { action: "allow", targetIdentity: identity });
    // console.log("[WB PERMISSION STATE BEFORE]", { controllers: hostControllersArrayRef.current });
    setHostControllersArray((list) => {
      const next = list.includes(identity) ? list : [...list, identity];
      // console.log("[WB PERMISSION STATE AFTER]", { controllers: next });
      return next;
    });
  }, [isHost]);

  // Host: revoke drawing permission from a participant.
  const hostRemoveWhiteboardControl = useCallback((identity: string) => {
    if (!isHost) return;
    // console.log("[WB PERMISSION CLICK]", { action: "deny", targetIdentity: identity });
    // console.log("[WB PERMISSION STATE BEFORE]", { controllers: hostControllersArrayRef.current });
    setHostControllersArray((list) => {
      const next = list.filter((id) => id !== identity);
      // console.log("[WB PERMISSION STATE AFTER]", { controllers: next });
      return next;
    });
  }, [isHost]);


  // ── Annotation mode ────────────────────────────────────────────────────────
  // Users can manually hide/show the overlay via the host control.
  // The WhiteboardCanvas instance stays mounted in both states — scene and
  // collaboration state are never lost during the transition.
  const handleToggleAnnotation = useCallback(() => {
    if (!isHost) return;
    setHostAnnotationActive((prev) => {
      const next = !prev;
      broadcastAnnotationState(next);
      return next;
    });
  }, [isHost, broadcastAnnotationState]);

  const hostAnnotationMountedRef = useRef(false);
  useEffect(() => {
    if (!isHost) return;
    if (!hostAnnotationMountedRef.current) {
      hostAnnotationMountedRef.current = true;
      return; 
    }
    broadcastAnnotationState(hostAnnotationActive);
  }, [isHost, hostAnnotationActive, broadcastAnnotationState]);

  // ── Host controls ─────────────────────────────────────────────────────────
  const [isLocked,         setIsLocked]         = useState(false); // meeting lock placeholder
  const [whiteboardLocked, setWhiteboardLocked] = useState(false); // whiteboard lock state

  // Ref so toggleWhiteboardLock can read the current controllers without capturing
  // a stale closure over hostControllersArray.
  const hostControllersArrayRef = useRef<string[]>([]);
  useEffect(() => { hostControllersArrayRef.current = hostControllersArray; }, [hostControllersArray]);

  const toggleWhiteboardLock = useCallback(() => {
    setWhiteboardLocked((locked) => {
      const next = !locked;
      // When locking: broadcast an empty controllers list so all participants
      // immediately become view-only.  When unlocking: restore the real list.
      // getReadOnlyState enforces the lock locally; broadcast keeps remotes in sync.
      const effectiveList = next ? [] : hostControllersArrayRef.current;
      whiteboardBroadcastPermissions(effectiveList);
      return next;
    });
  }, [whiteboardBroadcastPermissions]);
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

  // ── localIsSharing & screenShareActiveRef2 sync ───────────────────────────
  // Declared here — before the annotation auto-detect effect — so both effects
  // can read current values without order-of-declaration errors.
  // localIsSharing must be derived from isScreenShareEnabled (not from the track
  // list) to match the LiveKit hook's authoritative source.
  const localIsSharing = isScreenShareEnabled;

  // Keep screenShareActiveRef2 (used by the whiteboard auto-open effect above)
  // and the original screenShareActiveRef in sync with the current value.
  useEffect(() => {
    screenShareActiveRef2.current = screenShareActive;
  }, [screenShareActive]);

  // ── Annotation mode auto-detect ────────────────────────────────────────────
  // Removed: Annotation is now manually controlled by the host and fully decoupled from screen share state.

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
              {/*
               * position:relative is required here so that the annotation overlay
               * (WhiteboardPanel with annotationMode=true, absolute inset-0) is
               * clipped to this container and never bleeds over the thumbnail
               * sidebar, control bar, or header.
               */}
              <div className="relative flex-1 min-h-0 flex flex-col">
                <ScreenShareView
                  screenShareTrackRef={activeScreenShare}
                  sharerName={
                    resolveDisplayName(activeScreenShare.participant.name, activeScreenShare.participant.identity) +
                    (localIsSharing && activeScreenShare.participant.identity === localParticipant?.identity ? ' (You)' : '')
                  }
                  isLocalSharer={localIsSharing && activeScreenShare.participant.identity === localParticipant?.identity}
                  onStopShare={handleScreenShare}
                  onStageSize={handleAnnotationStageSize}
                >
                  {/* Annotation — always mounted. Visibility controlled by opacity/pointerEvents.
                      absolute inset-0 so it exactly fills annotation-overlay. */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: annotationActive ? 'auto' : 'none',
                      opacity: annotationActive ? 1 : 0,
                    }}
                  >
                    <WhiteboardPanel
                      meetingId={meeting.meetingId}
                      isHost={isHost}
                      whiteboardLocked={whiteboardLocked}
                      localIdentity={localParticipant?.identity || userId}
                      onToggleLock={toggleWhiteboardLock}
                      annotationMode
                      onClose={handleToggleAnnotation}
                      controllers={controllers}
                      excalidrawApiRef={annotationExcalidrawApiRef}
                      onLocalChange={annotationHandleLocalChange}
                    />
                  </div>
                </ScreenShareView>
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
            <div className="flex-1 overflow-hidden p-2 sm:p-3 bg-background/50">
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
            isLocalHost={isHost}
            controllers={controllers}
            onGiveWhiteboardControl={isHost ? hostGiveWhiteboardControl : undefined}
            onRemoveWhiteboardControl={isHost ? hostRemoveWhiteboardControl : undefined}
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

       

        {/* Whiteboard panel (normal sidebar — only shown when not in screen-share
            annotation mode; in annotation mode the canvas lives inside the
            screen-share container above as an absolute overlay) */}
        {(whiteboardOpen || showPanel === 'whiteboard') && !screenShareActive && (
          <div className={(showPanel === 'whiteboard' || (whiteboardOpen && !showPanel)) ? 'contents' : 'hidden'}>
            <WhiteboardPanel
              meetingId={meeting.meetingId}
              isHost={isHost}
              whiteboardLocked={whiteboardLocked}
              localIdentity={localParticipant?.identity || userId}
              onToggleLock={toggleWhiteboardLock}
              controllers={controllers}
              excalidrawApiRef={whiteboardExcalidrawApiRef}
              onLocalChange={whiteboardHandleLocalChange}
              onStageSize={handleWhiteboardStageSize}
              onClose={() => {
                setShowPanel(null);
                // Host closing the panel closes the whiteboard for everyone.
                if (isHost) setHostWhiteboardOpen(false);
              }}
            />
          </div>
        )}

        {/* Host controls panel — host only */}
        {/* */}
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

        {/* Breakout Rooms panel — host only */}
        {showPanel === 'breakout' && isHost && (
          <HostBreakoutPanel
            meetingId={meeting.meetingId}
            participants={participants}
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
        {screenShareActive && isHost && (
          <ControlButton
            active={annotationActive}
            activeIcon={<PenTool className="w-5 h-5" />}
            inactiveIcon={<PenTool className="w-5 h-5" />}
            activeLabel="Stop Annotating"
            inactiveLabel="Annotate"
            onToggle={handleToggleAnnotation}
            highlight={annotationActive}
          />
        )}
        {isHost ? (
          /* Host: whiteboard button opens for EVERYONE */
          <ControlButton active={whiteboardOpen}
            activeIcon={<PenTool className="w-5 h-5" />}
            inactiveIcon={<PenTool className="w-5 h-5" />}
            activeLabel="Close whiteboard" inactiveLabel="Open whiteboard"
            onToggle={() => {
              const next = !hostWhiteboardOpen;
              setHostWhiteboardOpen(next);
              // Also control the local panel visibility for the host.
              if (next) {
                setShowPanel('whiteboard');
              } else {
                setShowPanel((p) => p === 'whiteboard' ? null : p);
              }
            }}
            highlight={whiteboardOpen} />
        ) : (
          /* Participants: always can toggle whiteboard — no longer disabled. */
          <ControlButton active={showPanel === 'whiteboard'}
            activeIcon={<PenTool className="w-5 h-5" />}
            inactiveIcon={<PenTool className="w-5 h-5" />}
            activeLabel="Hide whiteboard" inactiveLabel="Whiteboard"
            onToggle={() => {
              if (showPanel === 'whiteboard') {
                setShowPanel(null);
              } else {
                setShowPanel('whiteboard');
                // Pull the latest scene from the host when manually opening.
                setTimeout(() => whiteboardRequestResync(), 200);
              }
            }}
            highlight={showPanel === 'whiteboard'} />
        )}
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
          <>
            <div className="flex flex-col items-center gap-1">
              <Button
                variant={showPanel === 'breakout' ? 'default' : 'outline'}
                className={`w-12 h-12 rounded-full p-0 flex items-center justify-center transition-colors
                  ${showPanel === 'breakout' ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-0' : ''}`}
                onClick={() => togglePanel('breakout')}
                title="Breakout Rooms"
                aria-label="Breakout Rooms"
                aria-pressed={showPanel === 'breakout'}
              >
                <Layers className="w-5 h-5" />
              </Button>
              <span className="text-[10px] text-muted-foreground hidden sm:block">Breakout</span>
            </div>
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
          </>
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
    <div className={`relative bg-zinc-800 rounded-lg overflow-hidden flex items-center justify-center shrink-0 w-full h-full md:h-auto aspect-video ring-2 transition-all duration-150 ${isSpeaking ? 'ring-emerald-400' : 'ring-transparent'}`}>
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
  
  let cols = 1;
  let rows = 1;

  if (count === 1) {
    cols = 1; rows = 1;
  } else if (count === 2) {
    cols = 2; rows = 1;
  } else if (count <= 4) {
    cols = 2; rows = 2;
  } else if (count <= 6) {
    cols = 3; rows = 2;
  } else if (count <= 9) {
    cols = 3; rows = 3;
  } else if (count <= 12) {
    cols = 4; rows = 3;
  } else {
    cols = 4;
    rows = Math.ceil(count / 4);
  }

  if (count === 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Waiting for participants…</div>;
  }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '8px',
    height: '100%',
    width: '100%',
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: count > 12 ? 'repeat(auto-fill, minmax(180px, 1fr))' : `repeat(${rows}, minmax(0, 1fr))`,
  };

  return (
    <div style={gridStyle} className={count > 12 ? 'overflow-y-auto content-start p-1' : 'place-items-center p-1'}>
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
    <div className="w-full h-full min-h-0 min-w-0 flex items-center justify-center p-0.5 sm:p-1">
      <div className={`relative bg-zinc-900 rounded-xl overflow-hidden flex items-center justify-center ring-2 transition-all duration-300 w-full h-full ${isSpeaking ? 'ring-emerald-400' : 'ring-transparent'}`}>
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
  // Host-controlled whiteboard permission props
  isLocalHost,
  controllers,
  onGiveWhiteboardControl,
  onRemoveWhiteboardControl,
}: {
  participants: Participant[];
  localParticipant: Participant | undefined;
  hostUserId: string | undefined;
  micByIdentity: Map<string, TrackReferenceOrPlaceholder>;
  cameraByIdentity: Map<string, TrackReferenceOrPlaceholder>;
  screenShareByIdentity: Map<string, true>;
  onClose: () => void;
  // Host whiteboard control callbacks — only called when isLocalHost is true
  isLocalHost: boolean;
  controllers: ReadonlySet<string>;
  onGiveWhiteboardControl?: (identity: string) => void;
  onRemoveWhiteboardControl?: (identity: string) => void;
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
              isLocalHost={isLocalHost}
              hasWhiteboardControl={controllers.has(participant.identity)}
              onGiveWhiteboardControl={onGiveWhiteboardControl}
              onRemoveWhiteboardControl={onRemoveWhiteboardControl}
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
  isLocalHost,
  hasWhiteboardControl,
  onGiveWhiteboardControl,
  onRemoveWhiteboardControl,
}: {
  participant: Participant;
  isLocal: boolean;
  isHost: boolean;
  micRef: TrackReferenceOrPlaceholder | undefined;
  cameraRef: TrackReferenceOrPlaceholder | undefined;
  isScreenSharing: boolean;
  isLocalHost: boolean;
  hasWhiteboardControl: boolean;
  onGiveWhiteboardControl?: (identity: string) => void;
  onRemoveWhiteboardControl?: (identity: string) => void;
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
    <div className="flex flex-col px-4 py-2.5 hover:bg-muted/40 transition-colors gap-1.5">
      <div className="flex items-center gap-3">
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
            {hasWhiteboardControl && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-500 bg-blue-500/10 rounded px-1 py-0.5 shrink-0">
                <PenTool className="w-2.5 h-2.5" />Drawing
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

      {/* Whiteboard control buttons — host only, non-host participants only */}
      {isLocalHost && !isLocal && !isHost && (
        <div className="pl-11 flex gap-1.5">
          {hasWhiteboardControl ? (
            <button
              onClick={() => onRemoveWhiteboardControl?.(participant.identity)}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors border border-blue-500/20"
              title={`Remove whiteboard control from ${label}`}
              aria-label={`Remove whiteboard control from ${label}`}
              disabled={!participant.identity}
            >
              <PenTool className="w-3 h-3" />
              Remove Drawing
            </button>
          ) : (
            <button
              onClick={() => onGiveWhiteboardControl?.(participant.identity)}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500 transition-colors border border-border"
              title={`Give whiteboard control to ${label}`}
              aria-label={`Give whiteboard control to ${label}`}
              disabled={!participant.identity}
            >
              <PenTool className="w-3 h-3" />
              Allow Drawing
            </button>
          )}
        </div>
      )}
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
       {/* classname message Square */}
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

