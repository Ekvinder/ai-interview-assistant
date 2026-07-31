import { AccessToken } from "livekit-server-sdk";

interface GenerateTokenParams {
  roomName: string;
  identity: string;
  /** Display name shown in the room UI — stored as participant.name */
  name?: string;
  /** Arbitrary JSON string stored as participant.metadata */
  metadata?: string;
}

export async function generateLiveKitToken({
  roomName,
  identity,
  name,
  metadata,
}: GenerateTokenParams) {
  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    metadata,
    ttl: "1h",
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  return await token.toJwt();
}
