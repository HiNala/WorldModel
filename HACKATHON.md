# World Model Hackathon — 60-Second Quickstart

**Worlds in Action / World Model Hackathon** — Get the core world model running so you can see what Marble + SparkJS can do.

---

## Prerequisites

- **Node ≥ 20.19** (check: `node -v`)
- **World Labs API key** — Every hackathon team gets Marble Pro. Get yours at [platform.worldlabs.ai](https://platform.worldlabs.ai/)

---

## Run the App (3 commands)

```powershell
cd C:\Users\NalaBook\Desktop\world_model
npm install
npm run dev
```

Open **http://localhost:3000**

---

## Generate Your First World

1. **Simple** mode is selected by default
2. Type a prompt, e.g.: *"A medieval village with stone cottages beside a river"*
3. Click **✨ Generate World**
4. Wait ~30–45 seconds (Marble processes in the cloud)
5. The 3D Gaussian splat renders in the viewer — **drag with mouse to orbit**

---

## What You're Seeing

| Tech | Role |
|------|------|
| **Marble API** | Text → 3D world (World Labs) |
| **SparkJS** | Renders Gaussian splats in the browser |
| **Three.js** | 3D scene + orbit camera |

---

## API Keys (.env)

Create `.env` in the project root:

```
WORLDLABS_API_KEY=wl_...    ← Required for world generation
ANTHROPIC_API_KEY=sk-ant-...   ← Optional, for Agent Control mode
```

Get keys:
- **World Labs:** [platform.worldlabs.ai](https://platform.worldlabs.ai/)
- **Anthropic:** [console.anthropic.com](https://console.anthropic.com/) (for agents)

---

## Agent Mission Control (Next Step)

When you’re ready for the Agent track:

1. Add `ANTHROPIC_API_KEY` to `.env`
2. Click **Agent Control** tab
3. Enter a mission, e.g.: *"Build a space station with a hangar and garden dome"*
4. Click **🚀 Launch Agents**
5. Claude orchestrates specialist agents; each generates worlds via Marble

---

## PICO Emulator (If Demo’ing on PICO)

```powershell
adb reverse tcp:3000 tcp:3000
```

In the emulator browser: **http://10.0.2.2:3000**

---

## Links

- [SensAI World Model Kits](https://github.com/SensAIHackademy/SensAIWorldModelKits)
- [Marble API Docs](https://docs.worldlabs.ai/)
- [SparkJS Docs](https://sparkjs.dev/)
- [PICO Developer Portal](https://developer.picoxr.com/)
