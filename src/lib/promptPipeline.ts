/**
 * Generation pipeline: prompt preprocessing, validation, and enhancement.
 * Aligns with Marble API best practices (docs.worldlabs.ai/marble/create/prompt-guides).
 */

export const MAX_PROMPT_LENGTH = 2000;

export type QualityTier = "weak" | "ok" | "strong";

/** Best-practice structure: Subject + Materials + Lighting + Spatial sense */
const QUALITY_SUGGESTIONS = [
  "Include specific materials (stone, wood, metal) and textures",
  "Add lighting/mood (morning light, soft shadows, golden hour)",
  "Describe spatial layout (foreground, background, paths)",
  "Mention scale (cozy, vast, human-scale)",
] as const;

function hasSpatialDetail(text: string): boolean {
  return /\b(paths?|road|street|bridge|steps|entrance|foreground|background|horizon|distant|nearby|cozy|vast|scale|layout|leading to)\b/i.test(text);
}

export interface PipelineResult {
  prompt: string;
  normalized: boolean;
  warnings: string[];
  suggestions: string[];
  qualityTier: QualityTier;
  /** True when input exceeded MAX_PROMPT_LENGTH and was truncated at word boundary */
  truncated: boolean;
}

/**
 * Normalize prompt: collapse whitespace, trim, ensure single spaces.
 */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Quick heuristic: does prompt have material/texture words?
 */
function hasMaterialDetail(text: string): boolean {
  const materialWords =
    /\b(stone|wood|metal|brick|cobblestone|thatched|weathered|moss|ivy|glass|concrete|marble|texture|granite|sand|gravel|leather|cloth|ceramic|tile|plaster|timber|pine|oak)\b/i;
  return materialWords.test(text);
}

/**
 * Quick heuristic: does prompt mention lighting or atmosphere?
 */
function hasLightingDetail(text: string): boolean {
  const lightingWords =
    /\b(sunlight|shadow|moonlight|glow|lit|bright|soft|golden|morning|evening|dappled|ambient|twilight|dawn|dusk|overcast|mist|fog|rain|neon|lit up|sunlit|moonlit)\b/i;
  return lightingWords.test(text);
}

/** Truncate at word boundary when over limit */
function truncateAtWordBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.8) return truncated.slice(0, lastSpace).trim();
  return truncated.trim();
}

/**
 * Run the prompt through the generation pipeline.
 * Normalizes whitespace, truncates at word boundary, and returns quality signals.
 *
 * @param rawPrompt - User or agent prompt (can include extra whitespace)
 * @returns Processed prompt plus warnings, suggestions, qualityTier, and truncated flag
 */
export function processPrompt(rawPrompt: string): PipelineResult {
  const normalized = normalizeWhitespace(rawPrompt);
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (normalized.length === 0) {
    return {
      prompt: normalized,
      normalized: false,
      warnings: ["Prompt is empty"],
      suggestions: [],
      qualityTier: "weak",
      truncated: false,
    };
  }

  const truncated = normalized.length > MAX_PROMPT_LENGTH;

  if (normalized.length > MAX_PROMPT_LENGTH) {
    warnings.push(`Prompt exceeds ${MAX_PROMPT_LENGTH} characters; it will be truncated by the API`);
  }

  if (normalized.length < 80 && !normalized.includes(",")) {
    suggestions.push("Short prompts often yield weaker results. Add commas and more detail.");
  }

  if (!hasMaterialDetail(normalized)) suggestions.push(QUALITY_SUGGESTIONS[0]);
  if (!hasLightingDetail(normalized)) suggestions.push(QUALITY_SUGGESTIONS[1]);
  if (!hasSpatialDetail(normalized) && normalized.length > 60) suggestions.push(QUALITY_SUGGESTIONS[2]);

  const hasHedgeWords = /\b(something like|maybe|kind of|idk|not sure|approximately)\b/i.test(normalized);
  if (hasHedgeWords && normalized.length < 150) {
    suggestions.push("Remove vague words (maybe, kind of); be specific.");
  }

  const materialOk = hasMaterialDetail(normalized);
  const lightingOk = hasLightingDetail(normalized);
  const spatialOk = hasSpatialDetail(normalized);
  const lengthOk = normalized.length >= 80 && normalized.includes(",");
  const qualityTier: QualityTier =
    materialOk && lightingOk && (spatialOk || normalized.length < 100) && lengthOk
      ? "strong"
      : materialOk || lightingOk
        ? "ok"
        : "weak";

  return {
    prompt: truncateAtWordBoundary(normalized, MAX_PROMPT_LENGTH),
    normalized: normalized !== rawPrompt,
    warnings,
    suggestions: [...new Set(suggestions)].slice(0, 3),
    qualityTier,
    truncated,
  };
}

/**
 * Enhance a short/vague prompt by appending best-practice hints.
 * Only runs when prompt < 100 chars and lacks materials and/or lighting.
 * May add: "soft natural lighting", "detailed textures and materials", "depth and sense of space".
 *
 * @param prompt - Already normalized prompt
 * @returns Enhanced prompt or unchanged if sufficient structure exists
 */
export function enhancePromptIfNeeded(prompt: string): string {
  const processed = processPrompt(prompt);
  if (processed.prompt.length >= 100) return processed.prompt;
  if (hasMaterialDetail(processed.prompt) && hasLightingDetail(processed.prompt)) return processed.prompt;

  const enhancements: string[] = [];
  if (!hasLightingDetail(processed.prompt)) {
    enhancements.push("soft natural lighting");
  }
  if (!hasMaterialDetail(processed.prompt)) {
    enhancements.push("detailed textures and materials");
  }
  if (processed.prompt.length < 80 && !hasSpatialDetail(processed.prompt)) {
    enhancements.push("depth and sense of space");
  }
  if (enhancements.length === 0) return processed.prompt;

  return `${processed.prompt}, ${enhancements.join(", ")}`;
}
