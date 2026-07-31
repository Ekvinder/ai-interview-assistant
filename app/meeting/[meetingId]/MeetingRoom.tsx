'use client';

import '@livekit/components-styles';
import { useEffect, useRef, useState, useCallback } from 'react';
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
  Hand,
  ShieldAlert,
  Lock,
  UserMinus,
  XCircle,
} from 'lucide-react';
import { getLiveKitToken } from '@/lib/api';
import { meetingClientService } from '@/services/client/meeting.service';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeetingInfo {
  title: string;
  meetingId: string;
  status: string;
  _id: string;
}

interface StoredToken {
  token: string;
  url: string;
  meetingId: string;
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

function useDuration(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
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
  const [loading, setLoading]       = useState(true);
  const leftRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setTokenError(null);
      try {
        const stored = sessionStorage.getItem(MEETING_TOKEN_KEY);
        if (stored) {
          const parsed: StoredToken = JSON.parse(stored);
          if (parsed.meetingId === meeting.meetingId) {
            if (!cancelled) { setToken(parsed.token); setServerUrl(parsed.url); }
            return;
          }
          sessionStorage.removeItem(MEETING_TOKEN_KEY);
        }
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
    init();
    return () => { cancelled = true; };
  }, [meeting.meetingId, userId, userName, userEmail]);

  const handleLeave = useCallback(async () => {
    if (leftRef.current) return;
    leftRef.current = true;
    sessionStorage.removeItem(MEETING_TOKEN_KEY);
    try { await meetingClientService.leaveMeeting(meeting.meetingId); } catch { /* non-blocking */ }
    router.push('/dashboard');
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
      <RoomContent meeting={meeting} onLeave={handleLeave} hostUserId={hostUserId} />
    </LiveKitRoom>
  );
}

// ─── Inner room ───────────────────────────────────────────────────────────────

function RoomContent({ meeting, onLeave, hostUserId }: { meeting: MeetingInfo; onLeave: () => void; hostUserId?: string }) {
  const connState                                          = useConnectionState();
  const participants                                       = useParticipants();
  const { localParticipant, isScreenShareEnabled }         = useLocalParticipant();
  const isConnected                                        = connState === ConnectionState.Connected;
  const duration                                           = useDuration(isConnected);

  // Panel state: 'participants' | 'chat' | 'host' | null
  const [showPanel, setShowPanel] = useState<'participants' | 'chat' | 'host' | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  // Ref mirrors showPanel so the unread effect always reads the current value
  const showPanelRef = useRef<'participants' | 'chat' | 'host' | null>(null);

  const togglePanel = useCallback((panel: 'participants' | 'chat' | 'host') => {
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

  // ── Raise hand — broadcast via data channel ───────────────────────────────
  const RAISE_HAND_TOPIC = 'raise-hand' as const;
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());

  const { send: sendHandSignal } = useDataChannel(RAISE_HAND_TOPIC, (msg) => {
    try {
      const { identity, raised } = JSON.parse(new TextDecoder().decode(msg.payload)) as { identity: string; raised: boolean };
      setRaisedHands((prev) => {
        const next = new Set(prev);
        if (raised) { next.add(identity); } else { next.delete(identity); }
        return next;
      });
    } catch { /* malformed payload — ignore */ }
  });

  const localHandRaised = !!(localParticipant && raisedHands.has(localParticipant.identity));

  const handleRaiseHand = useCallback(() => {
    if (!localParticipant) return;
    const raised = !localHandRaised;
    const payload = new TextEncoder().encode(
      JSON.stringify({ identity: localParticipant.identity, raised }),
    );
    // Update own state immediately (we don't receive our own data channel messages)
    setRaisedHands((prev) => {
      const next = new Set(prev);
      if (raised) { next.add(localParticipant.identity); } else { next.delete(localParticipant.identity); }
      return next;
    });
    // Broadcast to all other participants
    sendHandSignal(payload, {});
  }, [localParticipant, localHandRaised, sendHandSignal]);

  // ── Host controls ─────────────────────────────────────────────────────────
  const isHost = !!(hostUserId && localParticipant?.identity === hostUserId);
  const [isLocked,         setIsLocked]         = useState(false);
  const [removingIdentity, setRemovingIdentity] = useState<string | null>(null);
  const [endingMeeting,    setEndingMeeting]    = useState(false);

  // Join-request approval flow — uses a dedicated data channel.
  // Non-hosts broadcast a join-request when they connect.
  // Host receives it, shows a toast with Allow/Deny.
  // Host broadcasts join-response; denied user disconnects.
  const JOIN_REQ_TOPIC  = 'join-request'  as const;
  const JOIN_RESP_TOPIC = 'join-response' as const;

  // Track whether we've already sent our own join request this session
  const sentJoinReqRef = useRef(false);

  const { send: sendJoinResponse } = useDataChannel(JOIN_RESP_TOPIC, (msg) => {
    // Non-hosts listen for responses addressed to them
    if (isHost) return;
    try {
      const { targetIdentity, allowed } = JSON.parse(new TextDecoder().decode(msg.payload)) as
        { targetIdentity: string; allowed: boolean };
      if (targetIdentity !== localParticipant?.identity) return;
      if (!allowed) {
        toast.error('The host did not allow you to join this meeting.');
        // Disconnect after a short delay so the toast is visible
        setTimeout(() => onLeave(), 1500);
      }
    } catch { /* ignore */ }
  });

  const { send: sendJoinRequest } = useDataChannel(JOIN_REQ_TOPIC, (msg) => {
    // Only the host processes incoming join requests
    if (!isHost) return;
    try {
      const { identity, name: requesterName } = JSON.parse(new TextDecoder().decode(msg.payload)) as
        { identity: string; name: string };
      // Show a persistent toast the host can act on
      toast(`${requesterName} wants to join`, {
        duration: 30_000,
        action: {
          label: 'Allow',
          onClick: () => {
            const payload = new TextEncoder().encode(
              JSON.stringify({ targetIdentity: identity, allowed: true }),
            );
            sendJoinResponse(payload, {});
          },
        },
        cancel: {
          label: 'Deny',
          onClick: () => {
            const payload = new TextEncoder().encode(
              JSON.stringify({ targetIdentity: identity, allowed: false }),
            );
            sendJoinResponse(payload, {});
          },
        },
      });
    } catch { /* ignore */ }
  });

  // Non-hosts broadcast a join request once when connected
  useEffect(() => {
    if (isHost) return;
    if (connState !== ConnectionState.Connected) return;
    if (sentJoinReqRef.current) return;
    sentJoinReqRef.current = true;
    const name = resolveDisplayName(localParticipant?.name, localParticipant?.identity);
    const payload = new TextEncoder().encode(
      JSON.stringify({ identity: localParticipant?.identity, name }),
    );
    sendJoinRequest(payload, {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connState, isHost]);

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

  const cameraByIdentity = new Map<string, TrackReferenceOrPlaceholder>();
  for (const ref of allCameraTracks) cameraByIdentity.set(ref.participant.identity, ref);

  const micByIdentity = new Map<string, TrackReferenceOrPlaceholder>();
  for (const ref of allMicTracks) micByIdentity.set(ref.participant.identity, ref);

  // Screen share per-identity — used by participant panel to show indicator
  const screenShareByIdentity = new Map<string, true>();
  for (const ref of allScreenShareTracks) screenShareByIdentity.set(ref.participant.identity, true);

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
            <span className="font-mono tabular-nums">{duration}</span>
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
              {/* Screen share primary stage */}
              <div className="flex-1 relative bg-black flex items-center justify-center min-h-0 p-2">
                {'publication' in activeScreenShare && activeScreenShare.publication ? (
                  <VideoTrack
                    trackRef={activeScreenShare}
                    style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-white/50">
                    <Monitor className="w-16 h-16" />
                    <span className="text-sm">Loading screen share…</span>
                  </div>
                )}
                {/* Sharer name */}
                <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/60 text-white text-xs font-medium backdrop-blur-sm flex items-center gap-1.5">
                  <Monitor className="w-3 h-3" />
                  {resolveDisplayName(activeScreenShare.participant.name, activeScreenShare.participant.identity)}
                  {localIsSharing && activeScreenShare.participant.identity === localParticipant?.identity ? ' (You)' : ''}
                </div>
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
                raisedHands={raisedHands}
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
            raisedHands={raisedHands}
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
        {/* Raise hand button */}
        <div className="flex flex-col items-center gap-1">
          <Button
            variant={localHandRaised ? 'default' : 'outline'}
            className={`w-12 h-12 rounded-full p-0 flex items-center justify-center transition-colors
              ${localHandRaised ? 'bg-amber-500 hover:bg-amber-600 text-white border-0' : ''}`}
            onClick={handleRaiseHand}
            title={localHandRaised ? 'Lower hand' : 'Raise hand'}
            aria-label={localHandRaised ? 'Lower hand' : 'Raise hand'}
            aria-pressed={localHandRaised}
          >
            <Hand className="w-5 h-5" />
          </Button>
          <span className="text-[10px] text-muted-foreground hidden sm:block">
            {localHandRaised ? 'Lower' : 'Raise hand'}
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

function VideoGrid({ participants, localParticipant, cameraByIdentity, micByIdentity, localCameraEnabled, raisedHands }: {
  participants: Participant[];
  localParticipant: Participant | undefined;
  cameraByIdentity: Map<string, TrackReferenceOrPlaceholder>;
  micByIdentity: Map<string, TrackReferenceOrPlaceholder>;
  localCameraEnabled: boolean;
  raisedHands: Set<string>;
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
            localCameraEnabled={isLocal ? localCameraEnabled : undefined}
            handRaised={raisedHands.has(participant.identity)} />
        );
      })}
    </div>
  );
}

// ─── Participant tile ─────────────────────────────────────────────────────────

function ParticipantTile({ participant, cameraRef, micRef, isLocal, localCameraEnabled, handRaised }: {
  participant: Participant;
  cameraRef: TrackReferenceOrPlaceholder | undefined;
  micRef: TrackReferenceOrPlaceholder | undefined;
  isLocal: boolean;
  localCameraEnabled: boolean | undefined;
  handRaised?: boolean;
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
      {/* Raised hand badge — top-right corner */}
      {handRaised && (
        <div className="absolute top-6 right-4 w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center shadow-lg animate-bounce" title="Hand raised">
          <span className="text-base leading-none select-none">✋</span>
        </div>
      )}
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
  raisedHands,
  onClose,
}: {
  participants: Participant[];
  localParticipant: Participant | undefined;
  hostUserId: string | undefined;
  micByIdentity: Map<string, TrackReferenceOrPlaceholder>;
  cameraByIdentity: Map<string, TrackReferenceOrPlaceholder>;
  screenShareByIdentity: Map<string, true>;
  raisedHands: Set<string>;
  onClose: () => void;
}) {
  // Sort: raised hands first, then everyone else (stable — preserves join order within each group)
  const sorted = [...participants].sort((a, b) => {
    const aRaised = raisedHands.has(a.identity) ? 0 : 1;
    const bRaised = raisedHands.has(b.identity) ? 0 : 1;
    return aRaised - bRaised;
  });

  const raisedCount = raisedHands.size;

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
          {raisedCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-500/10 rounded-full px-1.5 py-0.5">
              ✋ {raisedCount}
            </span>
          )}
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
        {sorted.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">No participants yet</p>
        ) : (
          sorted.map((participant) => (
            <PanelRow
              key={participant.identity}
              participant={participant}
              isLocal={participant.identity === localParticipant?.identity}
              isHost={!!hostUserId && participant.identity === hostUserId}
              micRef={micByIdentity.get(participant.identity)}
              cameraRef={cameraByIdentity.get(participant.identity)}
              isScreenSharing={screenShareByIdentity.has(participant.identity)}
              isHandRaised={raisedHands.has(participant.identity)}
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
  isHandRaised,
}: {
  participant: Participant;
  isLocal: boolean;
  isHost: boolean;
  micRef: TrackReferenceOrPlaceholder | undefined;
  cameraRef: TrackReferenceOrPlaceholder | undefined;
  isScreenSharing: boolean;
  isHandRaised: boolean;
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
    <div className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors ${isHandRaised ? 'bg-amber-500/5' : ''}`}>
      {/* Avatar with speaking / hand-raised ring */}
      <div className={`relative shrink-0 rounded-full p-0.5 transition-colors ${isHandRaised ? 'bg-amber-400' : isSpeaking ? 'bg-emerald-400' : 'bg-transparent'}`}>
        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-muted text-foreground text-xs font-semibold">
            {abbr}
          </AvatarFallback>
        </Avatar>
        {/* Hand raised emoji overlay */}
        {isHandRaised && (
          <span className="absolute -top-1 -right-1 text-sm leading-none select-none">✋</span>
        )}
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
          {isHandRaised && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-500/10 rounded px-1 py-0.5 shrink-0">
              Hand raised
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
