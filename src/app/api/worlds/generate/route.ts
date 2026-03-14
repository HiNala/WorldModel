import { NextRequest, NextResponse } from "next/server";
import { generateWorldServer } from "@/lib/marble";
import { processPrompt, enhancePromptIfNeeded } from "@/lib/promptPipeline";

export const maxDuration = 300; // 5 min for Vercel Pro; 60s on Hobby

export async function POST(req: NextRequest) {
  const apiKey = process.env.WORLDLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "WORLDLABS_API_KEY not configured. Add it to .env in the project root and restart the dev server." },
      { status: 500 }
    );
  }

  let body: { prompt?: string; model?: "mini" | "plus"; imageUrl?: string; isPano?: boolean; enhance?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawPrompt = body.prompt?.trim() ?? "";
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : undefined;
  if (!rawPrompt && !imageUrl) {
    return NextResponse.json({ error: "Missing or empty prompt and imageUrl. Provide at least one." }, { status: 400 });
  }

  const processed = processPrompt(rawPrompt || "Scene from image");
  const finalPrompt = body.enhance ? enhancePromptIfNeeded(processed.prompt) : processed.prompt;
  const wasEnhanced = body.enhance && finalPrompt !== processed.prompt;

  const model = body.model === "plus" ? "plus" : "mini";

  try {
    const result = await generateWorldServer(
      finalPrompt,
      apiKey,
      undefined,
      model,
      imageUrl ? { imageUrl, isPano: !!body.isPano } : undefined
    );
    return NextResponse.json({
      ...result,
      pipeline_meta: {
        qualityTier: processed.qualityTier,
        enhanced: wasEnhanced,
        truncated: processed.truncated,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
