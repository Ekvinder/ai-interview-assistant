import { DeepgramClient } from "@deepgram/sdk";

// Create a single server-side Deepgram client instance
const getDeepgramClient = () => {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY environment variable is not set. Deepgram client cannot be initialized.");
  }
  
  return new DeepgramClient({ apiKey });
};

export const deepgramClient = getDeepgramClient();

/**
 * Creates and configures a realtime STT connection.
 * Note: The connection must be initiated server-side.
 * creates and confi
 * @returns A configured Deepgram Live connection
 */
export const createRealtimeTranscriptionConnection = async (sampleRate: number = 48000) => {
  // We use the pre-initialized and validated client
  const connection = await deepgramClient.listen.v1.connect({
    model: "nova-3",
    language: "en-US",
    smart_format: "true",
    punctuate: "true",
    interim_results: "true",
    encoding: "linear16",
    sample_rate: sampleRate.toString(),
  });

  return connection;
};
