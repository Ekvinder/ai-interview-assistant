import { NextResponse } from "next/server";
import { gemini } from "@/lib/gemini/client";

export async function GET() {
  try {
    const response = await gemini.models.generateContent({
      model: "gemini-3.1-flash-live-preview",
      contents: "Say hello in one sentence.",
    });

    return NextResponse.json({
      success: true,
      text: response.text,
    });
  } catch (error) {
  console.error("Gemini Error:", error);

  return NextResponse.json(
    {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    },
    { status: 500 }
  );
}}
// import { NextResponse } from "next/server";
// import { gemini } from "@/lib/gemini/client";

// export async function GET() {
//   try {
//     const models = await gemini.models.list();

//     return NextResponse.json(models);
//   } catch (error) {
//     console.error(error);

//     return NextResponse.json(
//       {
//         success: false,
//         error: error instanceof Error ? error.message : "Unknown error",
//       },
//       { status: 500 }
//     );
//   }
// }