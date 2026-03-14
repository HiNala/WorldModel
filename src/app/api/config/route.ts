import { NextResponse } from "next/server";

/**
 * Returns which API keys are configured (not the actual keys).
 * Used by the UI to show setup status.
 */
export async function GET() {
  return NextResponse.json({
    hasWorldLabs: !!process.env.WORLDLABS_API_KEY,
    hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
    hasElevenLabs: !!process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY,
  });
}
