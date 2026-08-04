/**
 * Client-safe LiveKit room options.
 * This file must NOT import anything from livekit-server-sdk.
 */

// Screen share encoding tuned to prevent buffering:
// - Cap at 15 fps (more than enough for code/slides; halves bandwidth vs 30 fps)
// - Cap at 3 Mbps (prevents bandwidth spike when sharing high-res displays)
// - VP9 codec compresses screen content (sharp edges, text) far better than VP8/H264
// - Disable simulcast for screen share (simulcast hurts quality for screen content)
export const roomOptions = {
  adaptiveStream: true,
  dynacast: true,
  publishDefaults: {
    screenShareEncoding: {
      maxBitrate: 3_000_000,  // 3 Mbps — prevents pipe saturation
      maxFramerate: 15,       // 15 fps is sufficient for screen content
    },
    videoCodec: 'vp9' as const, // much better compression for screen content
    screenShareSimulcast: false, // simulcast degrades screen share quality
  },
};
