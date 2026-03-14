# World Model Hackathon — 60-Second First Run

You're at the hackathon. Get a world generating in under 2 minutes.

---

## 1. Install & run

```powershell
cd C:\Users\NalaBook\Desktop\world_model
npm install
npm run dev
```

Open **http://localhost:3000**

---

## 2. Add your Marble API key

Create `.env` in the project root (or copy from `.env.example`):

```
WORLDLABS_API_KEY=wl_your_key_here
```

Get your key at the hack (every team gets Marble Pro) or [platform.worldlabs.ai](https://platform.worldlabs.ai/).

Restart the dev server after adding the key (`Ctrl+C` then `npm run dev`).

---

## 3. Generate your first world

1. **Simple** tab is selected by default
2. Type a prompt: *"A medieval village with stone cottages beside a river"* — [GENERATION_PIPELINE.md](GENERATION_PIPELINE.md) has prompt tips
3. Click **✨ Generate World**
4. Wait ~30–45 seconds (Marble processes in the cloud)
5. The 3D Gaussian splat renders — **drag to orbit** the view

---

## How world generation works

| Step | What happens |
|------|--------------|
| 1 | You send a text prompt (or image URL) to `/api/worlds/generate` |
| 2 | The API calls World Labs Marble: `POST worlds:generate` |
| 3 | Marble returns an operation ID — we poll every 5s until done |
| 4 | When done, we get `world_id` and `spz_url` (compressed splat) |
| 5 | SparkJS loads the `.spz` and renders it as a 3D Gaussian splat |

**Core tech:** Marble API (World Labs) + SparkJS (splat renderer) + Three.js (scene).

---

## Agent Control (when you're ready)

1. Add `ANTHROPIC_API_KEY` to `.env`
2. Click **Agent Control** tab (or press **2**)
3. Enter a mission: *"Build a space station with a hangar and garden dome"*
4. Click **Launch Agents** — Claude spawns specialist agents that each generate worlds

---

## PICO Emulator

Use port 3000 so the emulator can reach the app:

```powershell
npm run dev:pico
```

Then forward the port:

```powershell
adb reverse tcp:3000 tcp:3000
```

In emulator browser: **http://10.0.2.2:3000**
