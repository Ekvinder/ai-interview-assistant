'use client';

import { Participant } from 'livekit-client';
import { useParticipantInfo, useIsSpeaking } from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mic, MicOff, Video, VideoOff, Monitor, X, MicOff as MuteIcon, UserX } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function isCameraOn(cameraRef: TrackReferenceOrPlaceholder | undefined): boolean {
  if (!cameraRef) return false;
  if (!('publication' in cameraRef)) return false;
  if (!cameraRef.publication) return false;
  return !cameraRef.publication.isMuted;
}

function isScreenSharing(screenRef: TrackReferenceOrPlaceholder | undefined): boolean {
  if (!screenRef) return false;
  if (!('publication' in screenRef)) return false;
  if (!screenRef.publication) return false;
  return !screenRef.publication.isMuted;
}

// ── Per-participant row (safe to call hooks per component) ─────────────────────

interface ParticipantRowProps {
  participant: Participant;
  isLocal: boolean;
  isHost: boolean;
  micRef: TrackReferenceOrPlaceholder | undefined;
  cameraRef: TrackReferenceOrPlaceholder | undefined;
  screenRef: TrackReferenceOrPlaceholder | undefined;
  isRaisedHand: boolean;
  showHostControls: boolean;
  onMute: () => void;
  onRemove: () => void;
}

function ParticipantRow({
  participant,
  isLocal,
  isHost,
  micRef,
  cameraRef,
  screenRef,
  isRaisedHand,
  showHostControls,
  onMute,
  onRemove,
}: ParticipantRowProps) {
  const { name, identity } = useParticipantInfo({ participant });
  const isSpeaking = useIsSpeaking(participant);

  const displayName = resolveDisplayName(name, identity);
  const initials = makeInitials(displayName);
  const micMuted = isMicMuted(micRef);
  const cameraActive = isCameraOn(cameraRef);
  const screenActive = isScreenSharing(screenRef);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 group transition-colors">
      {/* Avatar */}
      <div className="relative shrink-0">
        <Avatar className="w-9 h-9">
          <AvatarFallback className="bg-zinc-700 text-white text-sm font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        {isSpeaking && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background" />
        )}
      </div>

      {/* Name + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium truncate max-w-[100px]">{displayName}</span>
          {isHost && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">Host</Badge>
          )}
          {isLocal && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">You</Badge>
          )}
          {isRaisedHand && (
            <span className="text-sm" title="Hand raised">🖐</span>
          )}
        </div>
      </div>

      {/* Status icons */}
      <div className="flex items-center gap-1 shrink-0">
        {screenActive && (
          <span title="Sharing screen">
            <Monitor className="w-3.5 h-3.5 text-blue-400" />
          </span>
        )}
        {cameraActive ? (
          <Video className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <VideoOff className="w-3.5 h-3.5 text-muted-foreground opacity-40" />
        )}
        {micMuted ? (
          <MicOff className="w-3.5 h-3.5 text-red-400" />
        ) : (
          <Mic className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Host controls — shown to host, not on own tile */}
      {showHostControls && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-muted-foreground hover:text-foreground"
            onClick={onMute}
            title="Mute participant"
            aria-label={`Mute ${displayName}`}
          >
            <MuteIcon className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            title="Remove participant"
            aria-label={`Remove ${displayName}`}
          >
            <UserX className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────────

interface ParticipantPanelProps {
  participants: Participant[];
  localParticipant: Participant | undefined;
  hostId: string;
  micByIdentity: Map<string, TrackReferenceOrPlaceholder>;
  cameraByIdentity: Map<string, TrackReferenceOrPlaceholder>;
  screenShareByIdentity: Map<string, TrackReferenceOrPlaceholder>;
  raisedHands: Set<string>;
  onClose: () => void;
  onMuteParticipant: (participant: Participant) => void;
  onRemoveParticipant: (participant: Participant) => void;
  isHost: boolean;
}

export default function ParticipantPanel({
  participants,
  localParticipant,
  hostId,
  micByIdentity,
  cameraByIdentity,
  screenShareByIdentity,
  raisedHands,
  onClose,
  onMuteParticipant,
  onRemoveParticipant,
  isHost,
}: ParticipantPanelProps) {
  return (
    <div className="flex flex-col h-full bg-background border-l w-64 sm:w-72 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="font-semibold text-sm">
          Participants
          <span className="ml-1.5 text-muted-foreground font-normal">({participants.length})</span>
        </h2>
        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onClose} aria-label="Close participants panel">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Participant list */}
      <div className="flex-1 overflow-y-auto min-h-0 py-1">
        {participants.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center mt-8">No participants</p>
        ) : (
          participants.map((participant) => {
            const isLocal = participant.identity === localParticipant?.identity;
            const participantIsHost = participant.identity === hostId;
            const showHostControls = isHost && !isLocal;

            return (
              <ParticipantRow
                key={participant.identity}
                participant={participant}
                isLocal={isLocal}
                isHost={participantIsHost}
                micRef={micByIdentity.get(participant.identity)}
                cameraRef={cameraByIdentity.get(participant.identity)}
                screenRef={screenShareByIdentity.get(participant.identity)}
                isRaisedHand={raisedHands.has(participant.identity)}
                showHostControls={showHostControls}
                onMute={() => onMuteParticipant(participant)}
                onRemove={() => onRemoveParticipant(participant)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
