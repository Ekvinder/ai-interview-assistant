import { AccessToken } from "livekit-server-sdk";

interface GenerateTokenParams {
  roomName: string;
  identity: string;
}

export async function generateLiveKitToken({
  roomName,
  identity,
}: GenerateTokenParams) {
  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
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