"use client";

import { useState, useCallback, useEffect } from "react";
import { AgentPanel } from "@/components/AgentPanel";

import { VoiceCommand } from "@/components/VoiceCommand";
import dynamic from "next/dynamic";
import { speak } from "@/lib/tts";
import type { Agent } from "@/lib/agents";
import type { OrchestratorEvent } from "@/lib/orchestrator";
import { DEMO_PROMPTS, DEMO_COMMANDS } from "@/lib/demos";

const WorldViewer = dynamic(() => import("@/components/WorldViewer").then((m) => m.WorldViewer), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[400px] items-center justify-center rounded-lg bg-gray-900 text-gray-500">
      <span className="animate-pulse">Loading viewer...</span>
    </div>
  ),
});

const DEFAULT_PROMPT =
  "A medieval village with stone cottages beside a river, surrounded by rolling green hills";

const DEFAULT_COMMAND =
  "Build a medieval village with a river, stone bridge, market square, and a hilltop castle";

interface WorldInfo {
  worldId: string;
  agentName: string;
  spzUrl: string | null;
}

export default function Home() {
  const [mode, setMode] = useState<"simple" | "agents">("simple");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [marbleModel, setMarbleModel] = useState<"mini" | "plus">("mini");
  const [command, setCommand] = useState(DEFAULT_COMMAND);
  const [status, setStatus] = useState("Ready");
  const [world, setWorld] = useState<{ world_id: string; spz_url: string | null } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Agent mission control state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [plan, setPlan] = useState<{ plan: string; phase?: string } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<{
    hasWorldLabs?: boolean;
    hasAnthropic?: boolean;
    hasElevenLabs?: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  async function handleSimpleGenerate() {
    setIsGenerating(true);
    setStatus("Starting...");
    setWorld(null);

    try {
      const res = await fetch("/api/worlds/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model: marbleModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setWorld(data);
      setStatus(`Done! World: ${data.world_id?.slice(0, 8)}...`);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setIsGenerating(false);
    }
  }

  const handleLaunchWithCommand = useCallback(
    async (cmd: string) => {
      if (!cmd.trim() || isRunning) return;
      setIsRunning(true);
      setCommand(cmd);
      setAgents([]);
      setAnnouncements([]);
      setWorlds([]);

      try {
        const res = await fetch("/api/orchestrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: cmd }),
        });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6)) as OrchestratorEvent;
                if (event.type === "agent") {
                  setAgents((prev) => {
                    const idx = prev.findIndex((a) => a.id === event.data.id);
                    const next = [...prev];
                    if (idx >= 0) next[idx] = event.data;
                    else next.push(event.data);
                    return next;
                  });
                } else if (event.type === "log") {
                  setAgents((prev) =>
                    prev.map((a) =>
                      a.id === event.data.agentId
                        ? {
                            ...a,
                            logs: [
                              ...a.logs,
                              {
                                time: Date.now(),
                                type: event.data.logType as "thought" | "action" | "result" | "error" | "spawn",
                                text: event.data.text,
                              },
                            ],
                          }
                        : a
                    )
                  );
                } else if (event.type === "announce") {
                  setAnnouncements((prev) => [...prev, event.data.message]);
                  speak(event.data.message).catch(() => {});
                } else if (event.type === "plan") {
                  setPlan({ plan: event.data.plan, phase: event.data.phase });
                } else if (event.type === "world") {
                  setWorlds((prev) => [
                    ...prev,
                    {
                      worldId: event.data.worldId,
                      agentName: event.data.agentName,
                      spzUrl: event.data.spzUrl,
                    },
                  ]);
                } else if (event.type === "error") {
                  setAnnouncements((prev) => [...prev, `❌ ${event.data.message}`]);
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        }
      }
    } catch (err) {
      setAnnouncements((prev) => [...prev, `❌ ${err instanceof Error ? err.message : "Unknown"}`]);
    } finally {
      setIsRunning(false);
    }
  },
    [isRunning]
  );

  const handleLaunchAgents = () => handleLaunchWithCommand(command);

  const orchestrator = agents.find((a) => a.role === "orchestrator");
  const specialists = agents.filter((a) => a.role !== "orchestrator");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800/80 bg-gray-950/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">WorldMind</h1>
            <p className="mt-0.5 text-sm text-gray-400">
              World Model Hackathon · Marble API + SparkJS
            </p>
          </div>
          <div className="flex gap-1 rounded-lg bg-gray-900/80 p-1">
            <button
              onClick={() => setMode("simple")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${mode === "simple" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25" : "text-gray-400 hover:text-white"}`}
            >
              Simple
            </button>
            <button
              onClick={() => setMode("agents")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${mode === "agents" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25" : "text-gray-400 hover:text-white"}`}
            >
              Agent Control
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl gap-6 p-4 sm:p-6">
        {mode === "simple" ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
                <label className="mb-2 block text-sm font-medium text-gray-400">World Prompt</label>
                {config && !config.hasWorldLabs && (
                  <div className="mb-3 rounded border border-amber-600/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
                    Add <code className="rounded bg-amber-900/50 px-1">WORLDLABS_API_KEY</code> to .env to generate worlds.
                  </div>
                )}
                <div className="mb-2 flex flex-wrap gap-2">
                  {DEMO_PROMPTS.map((d) => (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => setPrompt(d.prompt)}
                      disabled={isGenerating}
                      className="rounded-lg border border-gray-600 bg-gray-800/80 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-blue-500/50 hover:bg-gray-700 hover:text-white disabled:opacity-50"
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isGenerating) {
                      e.preventDefault();
                      handleSimpleGenerate();
                    }
                  }}
                  className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800/80 p-3 text-white placeholder-gray-500 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                  rows={4}
                  disabled={isGenerating}
                  placeholder="Describe the 3D world you want... (Ctrl+Enter to generate)"
                />
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Model:</span>
                  <button
                    type="button"
                    onClick={() => setMarbleModel("mini")}
                    disabled={isGenerating}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      marbleModel === "mini"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                    } disabled:opacity-50`}
                  >
                    mini (fast, ~30–45s)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarbleModel("plus")}
                    disabled={isGenerating}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      marbleModel === "plus"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                    } disabled:opacity-50`}
                  >
                    plus (quality, ~2–3min)
                  </button>
                </div>
                <button
                  onClick={handleSimpleGenerate}
                  disabled={isGenerating}
                  className="mt-4 w-full rounded-lg bg-blue-600 py-3 font-semibold shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 hover:shadow-blue-600/40 disabled:bg-gray-700 disabled:shadow-none"
                >
                  {isGenerating
                    ? marbleModel === "plus"
                      ? "⏳ Generating... (~2–3min)"
                      : "⏳ Generating... (~30–45s)"
                    : "✨ Generate World"}
                </button>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
                <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Status</div>
                <div
                  className={`mt-2 font-medium ${status.startsWith("Error") ? "text-red-400" : "text-white"}`}
                >
                  {status}
                </div>
                {world && (
                  <a
                    href={`https://marble.worldlabs.ai/world/${world.world_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 rounded-lg bg-blue-600/20 px-3 py-1.5 text-sm font-medium text-blue-400 transition hover:bg-blue-600/30"
                  >
                    Open in Marble Viewer →
                  </a>
                )}
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900/80">
              {world ? (
                <WorldViewer splatUrl={world.spz_url} worldId={world.world_id} />
              ) : (
                <div className="flex min-h-[500px] flex-col items-center justify-center gap-5 rounded-xl border-2 border-dashed border-gray-700/50 bg-gray-900/50 px-8 text-center">
                  <div className="text-5xl opacity-50">🌍</div>
                  <div>
                    <p className="text-gray-400">Generate a world to see it here</p>
                    <p className="mt-1 text-sm text-gray-600">World Labs Marble API + SparkJS</p>
                  </div>
                  <p className="text-xs text-gray-600">3D splat viewer loads when generation completes</p>
                  <a
                    href="https://marble.worldlabs.ai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 rounded-lg bg-gray-700/80 px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-600 hover:text-white"
                  >
                    Explore sample worlds at Marble →
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            className="grid gap-4 p-4"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
              gap: "1rem",
            }}
          >
            {/* Command Panel — Mission directive + voice */}
            <div className="command-panel space-y-4">
              <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
                <label className="mb-2 block text-sm font-medium text-gray-400">Mission Directive</label>
                {config && !config.hasAnthropic && (
                  <div className="mb-3 rounded border border-amber-600/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
                    Add <code className="rounded bg-amber-900/50 px-1">ANTHROPIC_API_KEY</code> to .env to enable Agent Control.
                  </div>
                )}
                <div className="mb-2 flex flex-wrap gap-2">
                  {DEMO_COMMANDS.map((d) => (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => {
                        setCommand(d.command);
                      }}
                      disabled={isRunning}
                      className="rounded-lg border border-gray-600 bg-gray-800/80 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-blue-500/50 hover:bg-gray-700 hover:text-white disabled:opacity-50"
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <div className="mb-3">
                  <VoiceCommand
                    onCommand={(text) => {
                      setCommand(text);
                      handleLaunchWithCommand(text);
                    }}
                    disabled={isRunning}
                  />
                </div>
                <textarea
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isRunning) {
                      e.preventDefault();
                      handleLaunchAgents();
                    }
                  }}
                  className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800/80 p-3 text-sm text-white placeholder-gray-500 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                  rows={3}
                  disabled={isRunning}
                  placeholder="Describe the world you want the agents to build... (Ctrl+Enter to launch)"
                />
                <button
                  onClick={handleLaunchAgents}
                  disabled={isRunning}
                  className="mt-4 w-full rounded-lg bg-blue-600 py-3 font-semibold shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 hover:shadow-blue-600/40 disabled:bg-gray-700 disabled:shadow-none"
                >
                  {isRunning ? "⏳ Agents Working..." : "🚀 Launch Agents"}
                </button>
              </div>
              {plan && (
                <div className="rounded-xl border border-blue-800/50 bg-blue-950/30 p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-blue-300">
                    📋 Build Plan {plan.phase && `· ${plan.phase}`}
                  </h3>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{plan.plan}</p>
                </div>
              )}
            </div>

            {/* Agent Panel — Orchestrator + specialists */}
            <div className="agent-panel space-y-4">
              {orchestrator && <AgentPanel agent={orchestrator} />}
              {specialists.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">Specialist Agents</h3>
                  {specialists.map((agent) => (
                    <AgentPanel key={agent.id} agent={agent} />
                  ))}
                </div>
              )}
            </div>

            {/* World Viewer Panel — 3D spatial view */}
            <div className="world-viewer-panel">
              <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900/80" style={{ minHeight: 400 }}>
                {worlds.length > 0 ? (
                  <WorldViewer
                    worlds={worlds.map((w) => ({
                      splatUrl: w.spzUrl,
                      worldId: w.worldId,
                      agentName: w.agentName,
                    }))}
                  />
                ) : (
                  <div className="flex min-h-[400px] flex-col items-center justify-center gap-5 rounded-xl border-2 border-dashed border-gray-700/50 bg-gray-900/50 px-8 text-center">
                  <div className="text-5xl opacity-50">🤖</div>
                  <p className="text-gray-400">
                    {isRunning ? "🔨 Agents are building worlds..." : "Launch agents to start building"}
                  </p>
                  <p className="text-xs text-gray-600">Claude orchestrates specialist agents to generate multiple worlds</p>
                  <a
                    href="https://marble.worldlabs.ai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 rounded-lg bg-gray-700/80 px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-600 hover:text-white"
                  >
                    Explore sample worlds at Marble →
                  </a>
                </div>
                )}
              </div>
            </div>

            {/* Activity Panel — Feed + generated worlds */}
            <div className="activity-panel space-y-4">
              <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">Activity Feed</h3>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {announcements.map((msg, i) => (
                    <div key={i} className="text-sm text-gray-300">
                      {msg}
                    </div>
                  ))}
                  {announcements.length === 0 && !isRunning && (
                    <div className="text-sm text-gray-600">No activity yet</div>
                  )}
                </div>
              </div>

              {worlds.length > 0 && (
                <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
                  <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">Generated Worlds</h3>
                  <div className="space-y-1">
                    {worlds.map((w, i) => (
                      <a
                        key={w.worldId}
                        href={`https://marble.worldlabs.ai/world/${w.worldId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg px-2 py-1.5 text-sm text-blue-400 transition hover:bg-blue-600/20 hover:text-blue-300"
                      >
                        🌍 World {i + 1} ({w.agentName}): {w.worldId.slice(0, 12)}...
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
