import { NextRequest, NextResponse } from "next/server";
import { generateLiveKitToken } from "@/services/livekit.service";

export async function POST(request: NextRequest) {
  try {
    const { roomName, identity } = await request.json();

    const token = await generateLiveKitToken({
      roomName,
      identity,
    });

    return NextResponse.json({
      success: true,
      token,
      url: process.env.LIVEKIT_URL,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate token",
      },
      {
        status: 500,
      }
    );
  }
}