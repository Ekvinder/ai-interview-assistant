import { EventEmitter } from "events";
import { Room, RoomEvent, RemoteTrack, Track, AudioStream, RemoteParticipant } from "@livekit/rtc-node";
import { createRealtimeTranscriptionConnection } from "./../../lib/deepgram";

export interface TranscriptEvent {
  type: "transcript-interim" | "transcript-final";
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: number;
}

import { TranscriptService } from "../transcript.service";

export class LiveKitTranscriptionService extends EventEmitter {
  private room: Room;
  private dgConnections: Map<string, any>;
  private audioStreams: Map<string, AudioStream>;

  constructor(private url: string, private token: string, private meetingId: string) {
    super();
    this.room = new Room();
    this.dgConnections = new Map();
    this.audioStreams = new Map();

    this.setupRoomListeners();
  }

  private setupRoomListeners() {
    this.room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: any, participant: RemoteParticipant) => {
      // @livekit/rtc-node Track.Kind is 'audio' or 'video' (string or enum, checking string for safety)
      if ((track.kind as any) === 'audio' || (track.kind as any) === 1) {
        this.startTranscriptionForTrack(track, participant);
      }
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub: any, participant: RemoteParticipant) => {
      if ((track.kind as any) === 'audio' || (track.kind as any) === 1) {
        this.stopTranscriptionForTrack(participant.identity);
      }
    });
    
    this.room.on(RoomEvent.Disconnected, () => {
      this.stop();
    });
  }

  public async start() {
    await this.room.connect(this.url, this.token);
  }

  public stop() {
    for (const [identity, stream] of this.audioStreams.entries()) {
      try {
        stream.cancel();
      } catch (e) {
        // ignore
      }
    }
    for (const [identity, dg] of this.dgConnections.entries()) {
      try {
        if (typeof dg.finish === 'function') dg.finish();
        if (typeof dg.disconnect === 'function') dg.disconnect();
        if (typeof dg.close === 'function') dg.close();
      } catch (e) {
        // ignore
      }
    }
    this.audioStreams.clear();
    this.dgConnections.clear();
    this.room.disconnect();
  }

  private async startTranscriptionForTrack(track: RemoteTrack, participant: RemoteParticipant) {
    const identity = participant.identity;
    const name = participant.name || identity;

    let dgConnection: any;
    try {
      // Create Deepgram connection (48000Hz is LiveKit's default audio format)
      dgConnection = await createRealtimeTranscriptionConnection(48000);
      this.dgConnections.set(identity, dgConnection);
    } catch (e) {
      console.error(`Failed to create Deepgram STT connection for ${identity}:`, e);
      return;
    }

    dgConnection.on("message", (data: any) => {
      if (data && data.type === "Results") {
        const channel = data.channel;
        const alternatives = channel?.alternatives;
        if (alternatives && alternatives.length > 0) {
          const message = alternatives[0].transcript;
          if (message && message.trim().length > 0) {
          const transcriptEvent = {
            type: data.is_final ? "transcript-final" : "transcript-interim",
            speakerId: identity,
            speakerName: name,
            text: message,
            timestamp: Date.now()
          };

          this.emit("transcript", transcriptEvent);

          // Broadcast to the LiveKit room on a dedicated topic
          if (this.room.localParticipant) {
            const encoded = new TextEncoder().encode(JSON.stringify(transcriptEvent));
            this.room.localParticipant.publishData(encoded, {
              reliable: true,
              topic: "meetspace-transcript"
            });
          }

          // Persist final results to MongoDB
          if (data.is_final) {
            TranscriptService.appendMeetingTranscript(
              this.meetingId,
              identity,
              name,
              message,
              transcriptEvent.timestamp
            ).catch((e) => {
              console.error("[TRANSCRIPT PERSISTENCE ERROR]", e);
            });
          }
          }
        }
      }
    });

    dgConnection.on("error", (error: any) => {
      console.error(`Deepgram STT error for ${identity}:`, error);
      this.stopTranscriptionForTrack(identity);
    });

    dgConnection.on("close", () => {
      this.stopTranscriptionForTrack(identity);
    });

    // Create LiveKit AudioStream
    const stream = new AudioStream(track, { sampleRate: 48000, numChannels: 1 });
    this.audioStreams.set(identity, stream);

    const processStream = async () => {
      try {
        const reader = stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && typeof dgConnection.send === 'function') {
            const buffer = Buffer.from(value.data.buffer, value.data.byteOffset, value.data.byteLength);
            dgConnection.send(buffer);
          }
        }
      } catch (error) {
        console.error(`LiveKit audio stream error for ${identity}:`, error);
        this.stopTranscriptionForTrack(identity);
      }
    };

    // Assuming the connect() already means it's open if awaited successfully.
    // Deepgram SDK also emits 'open' but wait may already cover it.
    processStream();
  }

  private stopTranscriptionForTrack(identity: string) {
    const stream = this.audioStreams.get(identity);
    if (stream) {
      try {
        stream.cancel();
      } catch (e) {
        // ignore errors during cleanup
      }
      this.audioStreams.delete(identity);
    }

    const dgConnection = this.dgConnections.get(identity);
    if (dgConnection) {
      try {
        if (typeof dgConnection.finish === 'function') dgConnection.finish();
        if (typeof dgConnection.disconnect === 'function') dgConnection.disconnect();
        if (typeof dgConnection.close === 'function') dgConnection.close();
      } catch (e) {
        // ignore errors during cleanup
      }
      this.dgConnections.delete(identity);
    }
  }
}
