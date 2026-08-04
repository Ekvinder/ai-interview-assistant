/**
 * Server-only LiveKit SDK helpers.
 * Do NOT import this file in client components — use lib/livekit-client-options.ts instead.
 */
import { RoomServiceClient, WebhookReceiver } from 'livekit-server-sdk';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!;
const LIVEKIT_URL = process.env.LIVEKIT_URL!;

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
  console.warn('LiveKit environment variables are not fully configured.');
}

export const livekitClient = new RoomServiceClient(
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET
);

export const webhookReceiver = new WebhookReceiver(
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET
);

// Re-export for server-side convenience — client code should import from lib/livekit-client-options
export { roomOptions } from './livekit-client-options';