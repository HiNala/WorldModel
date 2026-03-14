/**
 * Demo prompts for quick hackathon demos.
 * One-click to fill and optionally auto-generate.
 */

/** Style/atmosphere modifiers appended to prompts for richer worlds */
export const ATMOSPHERE_PRESETS = [
  { label: "Default", suffix: "" },
  { label: "Golden hour", suffix: ", golden hour sunlight, warm tones, long shadows" },
  { label: "Overcast", suffix: ", overcast sky, soft diffused light, muted colors" },
  { label: "Night", suffix: ", nighttime, moonlit, ambient glow, stars visible" },
  { label: "Foggy", suffix: ", atmospheric fog, misty, mysterious mood" },
  { label: "Rainy", suffix: ", rain, wet surfaces, puddles reflecting light" },
  { label: "Sunny noon", suffix: ", bright midday sun, sharp shadows, vibrant colors" },
] as const;

export const DEMO_PROMPTS = [
  {
    label: "Medieval Village",
    prompt:
      "A medieval village with weathered stone cottages, thatched roofs, and cobblestone paths beside a clear river, surrounded by rolling green hills, morning light casting long shadows",
  },
  {
    label: "Space Station",
    prompt:
      "A futuristic space station interior with large viewports overlooking Earth, metallic control panels, holographic displays, clean lighting, and reflective floors",
  },
  {
    label: "Japanese Garden",
    prompt:
      "A serene Japanese garden with cherry blossoms, koi pond, moss-covered stone lanterns, a wooden bridge, bamboo groves, and raked gravel paths in soft daylight",
  },
  {
    label: "Sci‑Fi City",
    prompt:
      "A neon-lit cyberpunk city street at night, flying cars, holographic ads reflecting on rain-slicked pavement, detailed architecture, and atmospheric fog",
  },
  {
    label: "Coastal Town",
    prompt:
      "A charming coastal fishing village with wooden piers, sailboats in harbor, whitewashed buildings, cobblestone waterfront, and ocean views",
  },
  {
    label: "Ancient Temple",
    prompt:
      "An ancient temple ruin overgrown with vines, moss-covered columns, crumbling stone steps, dappled sunlight through canopy, sense of mystery",
  },
] as const;

/** Sample image URL for image-to-world quick test (Unsplash, CC0) */
export const SAMPLE_IMAGE_URL =
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1024";

export const DEMO_COMMANDS = [
  {
    label: "Medieval World",
    command:
      "Build a medieval village with a river, stone bridge, market square, and a hilltop castle",
  },
  {
    label: "Space Base",
    command:
      "Create a lunar base with landing pads, domed habitats, solar panels, and Earth visible in the sky",
  },
  {
    label: "Fantasy Realm",
    command:
      "Design a magical forest with towering trees, glowing mushrooms, a crystal cave and a wizard tower",
  },
  {
    label: "Expand Scene",
    command:
      "Expand the current world: add more buildings, paths, and details that match the existing style and lighting. Make it feel like one cohesive place.",
  },
  {
    label: "Add Interior",
    command:
      "Create interior spaces: the inside of a tavern, a market stall, and a blacksmith forge—all matching the medieval village aesthetic.",
  },
] as const;
