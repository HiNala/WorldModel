# WorldMind — World Model Hackathon

A Next.js app for generating and viewing 3D worlds using **World Labs Marble API** and **SparkJS** (Gaussian splats). Built for the Worlds in Action / World Model Hackathon.

## Quick start (60 seconds)

**→ [HACKATHON.md](HACKATHON.md)** — Get a world generating in under a minute.

1. **Install**
   ```bash
   npm install
   ```

2. **Configure API keys**
   - Copy `.env.example` to `.env.local`
   - **World Labs**: `WORLDLABS_API_KEY=wl_...` — [platform.worldlabs.ai](https://platform.worldlabs.ai/)
   - **Anthropic** (for Agent Control): `ANTHROPIC_API_KEY=sk-ant-...` — [console.anthropic.com](https://console.anthropic.com/)

3. **Run**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

4. **Generate a world**
   - **Simple**: Enter a prompt, click **Generate World** (~30–45s)
   - **Agent Control**: Enter a mission or use **Hold to Speak** (voice), click **Launch Agents** — Claude spawns specialist agents that generate worlds
   - Agents announce progress (spoken via TTS if ElevenLabs key is set, else browser TTS)
   - View inline with SparkJS or open in [Marble Viewer](https://marble.worldlabs.ai/)

## Deploy (Vercel)

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add env vars: `WORLDLABS_API_KEY`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_ELEVENLABS_API_KEY` (optional, for richer TTS)
4. Deploy

**Note:** World generation can take 30–90s. Vercel Hobby has a 60s function timeout; use Pro for longer runs or pre-generate worlds.

## Tech stack

- **Next.js 16** + React 19
- **World Labs Marble API** — text/image/video → 3D Gaussian splats
- **SparkJS** — render splats in the browser
- **WebSpatial SDK** — spatial-ready layout for PICO / visionOS
- **Tailwind CSS**

## WebSpatial (spatial computing)

WorldMind uses the [WebSpatial SDK](https://webspatial.dev/) for spatial-capable builds. The multi-panel layout (Command, Agents, World Viewer, Activity) maps to spatial windows when run in WebSpatial environments.

- **Standard web**: `npm run dev` → http://localhost:3000
- **Spatial build** (visionOS / PICO): `npm run dev:spatial` runs both standard and XR builds

## PICO Emulator (for Agentic Mission Control track)

1. Install [Android Studio](https://developer.android.com/studio) (2025.1.x)
2. Download [PICO Spatial Plugin](https://developer.picoxr.com/resources/?platform=spatial) → Android Studio → Plugins → Install from Disk
3. Create PICO Emulator (Tools → Device Manager)
4. Start the emulator, then from your PC:
   ```bash
   adb reverse tcp:3000 tcp:3000
   ```
5. In the emulator, open the browser and go to **http://10.0.2.2:3000**
6. Your WorldMind app loads with Simple + Agent Control modes

**Tip:** Run `npm run dev` — if port 3000 is free, the app will use it. Otherwise run `npx next dev -p 3000` to force port 3000 for PICO.

## Demo preparation

### Pre-generate worlds (before demo)

Generate a few worlds in [Marble](https://marble.worldlabs.ai/) so they’re cached and fast to load:

1. "Futuristic AI command center with glowing holographic panels"
2. "Medieval village with cobblestone streets and a market square"
3. "Space station corridor with viewport showing distant planets"

Note their world IDs and use them as fallbacks or examples.

### Demo script (≈45 seconds)

| Time | Action |
|------|--------|
| 0:00 | Show dashboard: "This is WorldMind — a spatial AI command center" |
| 0:05 | Voice command: "Build a fantasy forest with an elven city in the trees" |
| 0:10 | Show Orchestrator thinking, spawning agents |
| 0:15 | Agent panels: Terrain Sculptor, Elven Architect, Lorekeeper |
| 0:20 | First world generates — open Marble viewer link |
| 0:25 | Orchestrator announces progress via TTS |
| 0:30 | Switch to PICO Emulator view with multi-panel layout |
| 0:35 | Second world generates — show in 3D viewer |
| 0:40 | "WorldMind: where AI agents build worlds together" |
| 0:45 | END |

## Hackathon resources

- [SensAI World Model Kits](https://github.com/SensAIHackademy/SensAIWorldModelKits)
- [Marble API Docs](https://docs.worldlabs.ai/)
- [SparkJS Docs](https://sparkjs.dev/)
- [WebSpatial SDK](https://webspatial.dev/) — spatial apps for PICO, visionOS
- [PICO Developer Portal](https://developer.picoxr.com/)

## License

MIT
