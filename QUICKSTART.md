# World Model Quick Start — How to Generate a World

Get the basic world model running in 3 steps.

## 1. Install & Run

```powershell
cd C:\Users\NalaBook\Desktop\world_model
npm install
npm run dev
```

Open **http://localhost:3000**

## 2. Generate Your First World

1. You'll see **Simple** mode (default)
2. Enter a prompt, e.g. *"A medieval village with stone cottages beside a river"*
3. Click **Generate World**
4. Wait ~30–45 seconds (Marble API processes in the cloud)
5. The 3D splat appears in the viewer — drag to orbit

## 3. What's Happening Under the Hood

```
Your prompt
    → POST /api/worlds/generate (keeps API key server-side)
    → Marble API: POST worlds:generate
    → Poll operations/{id} every 5s until done
    → Response includes SPZ URL (compressed Gaussian splat)
    → SparkJS SplatMesh loads SPZ in browser
    → 3D render with Three.js
```

## API Keys

- **WORLDLABS_API_KEY** — Required. In `.env` (you have this.)
- **ANTHROPIC_API_KEY** — For Agent Control mode (optional for basic world gen)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "WORLDLABS_API_KEY not configured" | Add key to `.env` in project root |
| Generation times out | Marble can take up to 2–3 min; wait or try a simpler prompt |
| Blank 3D viewer | Check browser console; SPZ URL may be missing (Marble returns world_id but sometimes no spz yet — use "Open in Marble Viewer" link) |

## Pre-Generate Worlds (Hackathon Tip)

Before the demo, generate 2–3 worlds at [marble.worldlabs.ai](https://marble.worldlabs.ai/) to have backups if live gen is slow.

---

## Next: Agent Mission Control

When you're ready for the Agent track:

1. Get an API key from [console.anthropic.com](https://console.anthropic.com/)
2. Add to `.env`: `ANTHROPIC_API_KEY=sk-ant-...`
3. Restart the dev server
4. Click **Agent Control** tab → enter a mission → **Launch Agents**
5. Claude orchestrates specialist agents that each generate worlds via Marble
