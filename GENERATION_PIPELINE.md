# Generation Pipeline

This document describes the world-generation pipeline: how prompts flow from the UI to the Marble API, and how to improve quality.

## Flow

```
User prompt → processPrompt() → [optional enhancePromptIfNeeded()] → Marble API → Poll → SPZ viewer
```

1. **Simple mode** (`page.tsx`): User types in the textarea. On Generate, the full prompt (including atmosphere preset suffix) is sent to `/api/worlds/generate` with an `enhance` flag when the prompt is short (< 120 chars) and no image is used.
2. **API route** (`api/worlds/generate/route.ts`): Runs `processPrompt()` to normalize and validate, then optionally `enhancePromptIfNeeded()` when `enhance: true`.
3. **Agent mode** (`orchestrator.ts`): When an agent calls `generate_world`, the prompt is run through `processPrompt()` before calling Marble.
4. **Marble** (`lib/marble.ts`): Sends the final prompt to World Labs; supports text-only or image-to-world.

## Prompt Pipeline (`lib/promptPipeline.ts`)

Run `npm run test` to execute pipeline tests (`promptPipeline.test.ts`).

### processPrompt(rawPrompt)

- **Normalize**: Collapse whitespace, trim
- **Truncate**: Max 2000 chars (Marble limit)
- **Heuristics**: Detect missing material/lighting detail
- **Returns**: `{ prompt, normalized, warnings, suggestions, qualityTier, truncated }`

### enhancePromptIfNeeded(prompt)

- Only runs when prompt is short (< 100 chars) and lacks structure
- Appends hints: "soft natural lighting", "detailed textures and materials", "depth and sense of space" (when spatial missing)
- Use sparingly — prefer user-provided detail

## Marble Best Practices

Reference: [docs.worldlabs.ai/marble/create/prompt-guides](https://docs.worldlabs.ai/marble/create/prompt-guides)

1. **Describe a location** — "a medieval village" is weaker than "a sunlit medieval village with stone cottages and thatched roofs beside a river"
2. **Materials & textures** — stone, wood, cobblestone, thatched, weathered, moss, ivy
3. **Lighting & mood** — morning light, golden hour, soft shadows, dappled light
4. **Spatial sense** — foreground/background, paths, scale
5. **Length** — Up to 2000 chars; detailed prompts often yield better results

## Prompt Template

```
[Subject]: [what the place is]
[Materials]: [specific surfaces: stone, wood, metal, cobblestone, moss, ivy, etc.]
[Lighting]: [time of day + mood: morning light, golden hour, soft shadows, dappled]
[Spatial]: [layout: path leading to..., foreground, scale: cozy/vast]
```

Example: *A medieval village square with weathered stone buildings, thatched roofs, and cobblestone paths, morning light casting long shadows, a stone well in the center, ivy on walls*

## Examples: Good vs Weak

| Weak | Good |
|------|------|
| "a medieval area" | "A sunlit medieval courtyard with a stone well, ivy-covered walls, cobblestone paths, morning light" |
| "cyberpunk city" | "A neon-lit cyberpunk street at night, rain-slicked pavement, holographic ads, refractions, fog" |
| "space station" | "A futuristic space station interior with metallic panels, large viewports, Earth visible, ambient lighting" |

## AI Self-Prompt (for Cursor / future agents)

When editing world-generation code or writing prompts for Marble:

1. **Follow the formula**: Subject → Materials → Lighting → Spatial. Use commas.
2. **Concrete nouns**: "cobblestone square", "stone well", "ivy-covered walls" — not "nice area", "thing"
3. **Atmosphere**: Always include lighting/mood (morning mist, sunset glow, overcast, neon-lit)
4. **Agent mode**: Keep style, lighting, and scale consistent across zones — one coherent world
5. **Image-to-world**: If image_url is used, prompt can be shorter; text supplements the image
6. **Max 2000 chars**; pipeline truncates at word boundaries
7. **Reference**: See `lib/promptPipeline.ts` heuristics (hasMaterialDetail, hasLightingDetail, hasSpatialDetail) for what the pipeline considers "quality"

## Debugging Generation Issues

When outputs are blurry, off-style, or inconsistent:

1. **Check the prompt** — Inspect what was actually sent (API returns `pipeline_meta`: `qualityTier`, `enhanced`, `truncated`)
2. **qualityTier** — `weak` = missing materials/lighting; `ok` = has some; `strong` = materials + lighting + structure
3. **Model** — `plus` typically yields better fidelity than `mini`
4. **Length** — Very short prompts (< 80 chars, no commas) often produce generic results
5. **Image-to-world** — If using an image, text supplements; ensure image resolution is adequate (1024 on long side)
6. **Blob-like output** — Use plus model (mini often yields low-detail blob-like results). Use Default atmosphere when prompt already describes lighting. disable_recaption: true sends our processed prompt as-is.
7. **Orchestrator** — Agent prompts are processed the same way; check logs for what each agent sent
8. **Atmosphere preset** — Applied client-side before send; verify suffix isn’t duplicating or conflicting

## Review Checklist (for pipeline improvements)

When improving the generation pipeline:

- [x] Heuristics cover common good-prompt patterns (materials, lighting, spatial)
- [x] Anti-patterns catch vague language (maybe, kind of)
- [x] Truncation preserves word boundaries
- [x] enhancePromptIfNeeded is conservative (short prompts only)
- [x] API returns pipeline_meta for transparency
- [x] Orchestrator system prompt reflects the formula
- [x] UI gives actionable feedback (suggestions, Improve button)
