/**
 * Demo prompts for quick hackathon demos.
 * One-click to fill and optionally auto-generate.
 */

export const DEMO_PROMPTS = [
  {
    label: "Medieval Village",
    prompt:
      "A medieval village with stone cottages beside a river, surrounded by rolling green hills",
  },
  {
    label: "Space Station",
    prompt:
      "A futuristic space station interior with large viewports overlooking Earth, control panels and holographic displays",
  },
  {
    label: "Japanese Garden",
    prompt:
      "A serene Japanese garden with cherry blossoms, koi pond, stone lanterns and a wooden bridge",
  },
  {
    label: "Sci‑Fi City",
    prompt:
      "A neon-lit cyberpunk city street at night, flying cars, holographic ads, rain-slicked pavement",
  },
] as const;

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
] as const;
