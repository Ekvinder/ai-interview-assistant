import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

let session: any = null;

export async function createLiveSession() {
  session = await ai.live.connect({
    model: "gemini-3.1-flash-live-preview",

    config: {
  responseModalities: [Modality.AUDIO],

  outputAudioTranscription: {},

  systemInstruction:
    "You are a professional AI interviewer. Greet the candidate.",
},

    callbacks: {
      onopen: () => {
        console.log("✅ Gemini Live Connected");
      },

     onmessage: (message) => {
  console.log("======== MESSAGE ========");

  if (message.serverContent?.outputTranscription?.text) {
    console.log(
      "Transcript:",
      message.serverContent.outputTranscription.text
    );
  }

  if (message.data) {
    console.log("Audio chunk received");
  }

  console.log(JSON.stringify(message, null, 2));
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