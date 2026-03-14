/**
 * Marble API types and server-side helpers.
 * API calls go through /api/worlds/generate to keep keys server-side.
 */

const API_BASE = "https://api.worldlabs.ai/marble/v1";

export interface WorldResult {
  world_id: string;
  display_name: string;
  world_marble_url: string;
  spz_url: string | null;
}

export const MARBLE_MODELS = {
  mini: "Marble 0.1-mini", // ~30–45s, ~$0.20
  plus: "Marble 0.1-plus", // ~2–3min, ~$1.20, higher quality
} as const;

export type MarbleModel = keyof typeof MARBLE_MODELS;

export interface GenerateOptions {
  /** Optional image URL for image-to-world. If set, uses image prompt with optional text. */
  imageUrl?: string;
  /** Whether the image is panoramic (360°). */
  isPano?: boolean;
}

export async function generateWorldServer(
  prompt: string,
  apiKey: string,
  onProgress?: (msg: string) => void,
  model: MarbleModel | string = "mini",
  options?: GenerateOptions
): Promise<WorldResult> {
  onProgress?.("Starting world generation...");

  const modelId = model in MARBLE_MODELS ? MARBLE_MODELS[model as MarbleModel] : model;
  const displayName = prompt.slice(0, 50) || "Generated world";

  const worldPrompt = options?.imageUrl
    ? (() => {
        const isDataUrl = options.imageUrl.startsWith("data:");
        if (isDataUrl) {
          const match = options.imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
          if (match) {
            const ext = match[1] === "jpeg" ? "jpg" : match[1];
            return {
              type: "image" as const,
              image_prompt: {
                source: "data_base64" as const,
                data_base64: match[2],
                extension: ext,
              },
              text_prompt: prompt || undefined,
              is_pano: options.isPano ?? false,
              disable_recaption: !!prompt,
            };
          }
        }
        return {
          type: "image" as const,
          image_prompt: {
            source: "uri" as const,
            uri: options.imageUrl,
          },
          text_prompt: prompt || undefined,
          is_pano: options.isPano ?? false,
          disable_recaption: !!prompt,
        };
      })()
    : {
        type: "text" as const,
        text_prompt: prompt,
        disable_recaption: true,
      };

  const res = await fetch(`${API_BASE}/worlds:generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "WLT-Api-Key": apiKey,
    },
    body: JSON.stringify({
      display_name: displayName,
      model: modelId,
      world_prompt: worldPrompt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Marble API error: ${res.status} - ${err}`);
  }

  const operation = await res.json();
  const operationId = operation.operation_id ?? operation.name;
  if (!operationId) {
    throw new Error("No operation ID in response");
  }

  onProgress?.("World generation in progress...");

  let attempts = 0;
  while (attempts < 120) {
    await new Promise((r) => setTimeout(r, 5000));
    attempts++;

    const pollRes = await fetch(`${API_BASE}/operations/${operationId}`, {
      headers: { "WLT-Api-Key": apiKey },
    });
    const status = await pollRes.json();

    if (status.error) {
      throw new Error(status.error.message ?? "Generation failed");
    }

    if (status.done && status.response) {
      onProgress?.("World generated!");
      const world = status.response;
      const worldId = world.world_id ?? world.id;
      const worldMarbleUrl = world.world_marble_url ?? `https://marble.worldlabs.ai/world/${worldId}`;

      const spzUrls = world.assets?.splats?.spz_urls;
      const spzUrl =
        spzUrls?.full_res ??
        spzUrls?.["2m"] ??
        spzUrls?.["2M"] ??
        spzUrls?.["500k"] ??
        spzUrls?.["100k"] ??
        Object.values(spzUrls ?? {})[0] ??
        null;

      return {
        world_id: worldId,
        display_name: world.display_name ?? prompt.slice(0, 50),
        world_marble_url: worldMarbleUrl,
        spz_url: spzUrl,
      };
    }

    onProgress?.(`Generating... (${attempts * 5}s elapsed)`);
  }

  throw new Error("Generation timed out");
}

export function getWorldViewerUrl(worldId: string): string {
  return `https://marble.worldlabs.ai/world/${worldId}`;
}
