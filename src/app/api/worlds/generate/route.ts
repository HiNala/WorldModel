import { NextRequest, NextResponse } from "next/server";
import { generateWorldServer } from "@/lib/marble";

export const maxDuration = 300; // 5 min for Vercel Pro; 60s on Hobby

export async function POST(req: NextRequest) {
  const apiKey = process.env.WORLDLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "WORLDLABS_API_KEY not configured. Add it to Vercel env vars or .env.local." },
      { status: 500 }
    );
  }

  let body: { prompt?: string; model?: "mini" | "plus" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "Missing or empty prompt" }, { status: 400 });
  }

  const model = body.model === "plus" ? "plus" : "mini";

  try {
    const result = await generateWorldServer(prompt, apiKey, undefined, model);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
