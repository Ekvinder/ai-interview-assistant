import { NextResponse } from "next/server";
import { createLiveSession } from "@/lib/gemini/live";

export async function GET() {
  const session = await createLiveSession();

 await  session.sendRealtimeInput({
    text: "Hello, introduce yourself as an AI interviewer.",
  });

  return NextResponse.json({
    success: true,
  });
}