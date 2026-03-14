import { describe, it, expect } from "vitest";
import { processPrompt, enhancePromptIfNeeded, MAX_PROMPT_LENGTH } from "./promptPipeline";

describe("processPrompt", () => {
  it("normalizes whitespace", () => {
    const r = processPrompt("  foo   bar  \n  baz  ");
    expect(r.prompt).toBe("foo bar baz");
    expect(r.normalized).toBe(true);
  });

  it("returns weak for empty prompt", () => {
    const r = processPrompt("");
    expect(r.prompt).toBe("");
    expect(r.qualityTier).toBe("weak");
    expect(r.warnings).toContain("Prompt is empty");
  });

  it("returns strong for well-structured prompt", () => {
    const r = processPrompt(
      "A medieval village with stone cottages, cobblestone paths beside a river, morning light casting long shadows across the square"
    );
    expect(r.qualityTier).toBe("strong");
  });

  it("returns weak for short vague prompt", () => {
    const r = processPrompt("a medieval area");
    expect(r.qualityTier).toBe("weak");
    expect(r.suggestions.length).toBeGreaterThan(0);
  });

  it("returns ok when has materials but not lighting", () => {
    const r = processPrompt("A stone castle with wooden doors and cobblestone courtyard");
    expect(r.qualityTier).toBe("ok");
  });

  it("truncates at word boundary when over limit", () => {
    const long = "word ".repeat(500); // ~2500 chars
    const r = processPrompt(long);
    expect(r.prompt.length).toBeLessThanOrEqual(MAX_PROMPT_LENGTH);
    expect(r.prompt.endsWith(" ")).toBe(false);
    expect(r.truncated).toBe(true);
    expect(r.warnings.some((w) => w.includes("truncated"))).toBe(true);
  });

  it("detects hedge words and suggests removal", () => {
    const r = processPrompt("maybe something like a cabin");
    expect(r.suggestions.some((s) => s.includes("specific") || s.includes("vague"))).toBe(true);
  });

  it("does not truncate when under limit", () => {
    const r = processPrompt("A sunlit garden with moss and stone");
    expect(r.truncated).toBe(false);
  });
});

describe("enhancePromptIfNeeded", () => {
  it("returns unchanged for long prompts", () => {
    const p = "A medieval village with stone cottages, cobblestone paths, morning light";
    expect(enhancePromptIfNeeded(p)).toBe(p);
  });

  it("returns unchanged when materials and lighting present", () => {
    const p = "Stone cottage with morning light";
    expect(enhancePromptIfNeeded(p)).toBe(p);
  });

  it("adds lighting and materials for short vague prompt", () => {
    const p = "cozy cabin";
    const out = enhancePromptIfNeeded(p);
    expect(out).toContain("soft natural lighting");
    expect(out).toContain("detailed textures");
    expect(out).toContain("cozy cabin");
  });

  it("adds depth when spatial missing and prompt very short", () => {
    const p = "a room";
    const out = enhancePromptIfNeeded(p);
    expect(out).toContain("depth and sense of space");
  });
});
