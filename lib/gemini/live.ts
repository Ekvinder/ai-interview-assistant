import { GoogleGenAI, Modality } from "@google/genai";

// Lazy-initialised client — avoids connecting to Gemini on module import.
let ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
      httpOptions: { apiVersion: 'v1alpha' },
    });
  }
  return ai;
}

let session: any = null;

export async function createLiveSession() {
  session = await getAI().live.connect({
    model: "gemini-2.0-flash-live-preview",
    config: {
      responseModalities: [Modality.AUDIO],
      outputAudioTranscription: {},
      systemInstruction: "You are a professional AI interviewer. Greet the candidate.",
    },
    callbacks: {
      onopen: () => {
        console.log("✅ Gemini Live Connected");
      },
      onmessage: (message) => {
        if (message.serverContent?.outputTranscription?.text) {
          console.log("Transcript:", message.serverContent.outputTranscription.text);
        }
      },
      onerror: (error) => {
        console.error("Gemini Error:", error);
      },
      onclose: (event) => {
        console.log("Gemini Closed:", event.reason);
      },
    },
  });

  return session;
}

export function getSession() {
  return session;
}
