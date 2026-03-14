"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AgentPanel } from "@/components/AgentPanel";

import { VoiceCommand } from "@/components/VoiceCommand";
import dynamic from "next/dynamic";
import { speak } from "@/lib/tts";
import type { Agent } from "@/lib/agents";
import type { OrchestratorEvent } from "@/lib/orchestrator";
import { DEMO_PROMPTS, DEMO_COMMANDS, SAMPLE_IMAGE_URL, ATMOSPHERE_PRESETS } from "@/lib/demos";
import { processPrompt, enhancePromptIfNeeded, MAX_PROMPT_LENGTH } from "@/lib/promptPipeline";

const WorldViewer = dynamic(() => import("@/components/WorldViewer").then((m) => m.WorldViewer), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[400px] items-center justify-center rounded-lg bg-gray-900 text-gray-500">
      <span className="animate-pulse">Loading viewer...</span>
    </div>
  ),
});

const DEFAULT_PROMPT =
  "A medieval village with weathered stone cottages and thatched roofs beside a clear river, surrounded by rolling green hills, detailed cobblestone paths, morning light";

const DEFAULT_COMMAND =
  "Build a medieval village with a river, stone bridge, market square, and a hilltop castle";

function PromptPipelineFeedback({
  prompt,
  atmosphere,
  hasImage,
  onImprove,
}: {
  prompt: string;
  atmosphere: string;
  hasImage?: boolean;
  onImprove?: (enhanced: string) => void;
}) {
  const atmosphereSuffix = ATMOSPHERE_PRESETS.find((a) => a.label === atmosphere)?.suffix ?? "";
  const full = (prompt || "").trim() + atmosphereSuffix;
  const { warnings, suggestions, qualityTier } = processPrompt(full);
  const len = full.length;
  const nearLimit = len > MAX_PROMPT_LENGTH * 0.9;

  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs text-gray-500">
        <span className={nearLimit ? "text-amber-400" : ""}>{len}/{MAX_PROMPT_LENGTH}</span>
        {!hasImage && qualityTier === "weak" && suggestions.length === 0 && (
          <span className="ml-2 text-amber-400/90">· Add materials and lighting for better results</span>
        )}
        {!hasImage && suggestions.length > 0 && (
          <span className="ml-2 text-gray-400">· {suggestions[0]}</span>
        )}
        {!hasImage && qualityTier === "weak" && onImprove && (
          <button
            type="button"
            onClick={() => {
              const base = (prompt || "").trim();
              const enhanced = enhancePromptIfNeeded(base);
              if (enhanced !== base) onImprove(enhanced);
            }}
            className="ml-2 text-xs text-blue-400 hover:text-blue-300"
          >
            Improve
          </button>
        )}
      </p>
      {warnings.length > 0 && (
        <p className="text-xs text-amber-400">{warnings.join(" ")}</p>
      )}
    </div>
  );
}

interface WorldInfo {
  worldId: string;
  agentName: string;
  spzUrl: string | null;
}

export default function Home() {
  const [mode, setMode] = useState<"simple" | "agents">("simple");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [imageUrl, setImageUrl] = useState("");
  const [isPano, setIsPano] = useState(false);
  const [marbleModel, setMarbleModel] = useState<"mini" | "plus">("plus");
  const [atmosphere, setAtmosphere] = useState<string>("Default");
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
  const [elapsedSec, setElapsedSec] = useState(0);
  const [agentElapsedSec, setAgentElapsedSec] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedWorldId, setCopiedWorldId] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const agentViewerRef = useRef<HTMLDivElement>(null);
  const activityFeedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === "1") setMode("simple");
      if (e.key === "2") setMode("agents");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!isGenerating) return;
    setElapsedSec(0);
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isGenerating]);

  useEffect(() => {
    if (!isRunning) return;
    setAgentElapsedSec(0);
    const id = setInterval(() => setAgentElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  useEffect(() => {
    activityFeedRef.current?.scrollTo?.({ top: activityFeedRef.current.scrollHeight, behavior: "smooth" });
  }, [announcements]);

  // Update status message during generation for better feedback
  useEffect(() => {
    if (!isGenerating) return;
    const phase =
      elapsedSec < 5
        ? "Connecting to Marble..."
        : elapsedSec < 15
          ? "Marble is building your world..."
          : marbleModel === "plus"
            ? elapsedSec < 90
              ? "Plus model: typically 2–3 min..."
              : "Almost there..."
            : elapsedSec < 45
              ? "Almost there..."
              : "Taking a bit longer than usual...";
    setStatus(`${phase} (${elapsedSec}s)`);
  }, [isGenerating, elapsedSec, marbleModel]);

  async function handleSimpleGenerate() {
    setIsGenerating(true);
    setStatus("Starting...");
    setWorld(null);

    try {
      const atmosphereSuffix = ATMOSPHERE_PRESETS.find((a) => a.label === atmosphere)?.suffix ?? "";
      const fullPrompt = (prompt || "Scene from image").trim() + atmosphereSuffix;
      const enhance = !imageUrl.trim() && fullPrompt.length < 120;
      const body: Record<string, unknown> = { prompt: fullPrompt, model: marbleModel, enhance };
      if (imageUrl.trim()) {
        body.imageUrl = imageUrl.trim();
        body.isPano = isPano;
      }
      const res = await fetch("/api/worlds/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setWorld(data);
      const meta = data.pipeline_meta;
      const metaHint =
        meta?.enhanced ? " (prompt enhanced)" : meta?.qualityTier === "strong" ? "" : meta?.qualityTier ? ` (${meta.qualityTier})` : "";
      setStatus(`Done! World: ${data.world_id?.slice(0, 8)}...${metaHint}`);
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
              World Model Hackathon · Marble API + SparkJS · <span className="text-gray-500">1/2 switch mode</span>
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
                      onClick={() => {
                        setPrompt(d.prompt);
                        setAtmosphere("Default");
                      }}
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
                <PromptPipelineFeedback
                  prompt={prompt}
                  atmosphere={atmosphere}
                  hasImage={!!imageUrl.trim()}
                  onImprove={setPrompt}
                />
                <div className="mt-2">
                  <span className="text-xs text-gray-500">Atmosphere: </span>
                  <span className="ml-1 text-xs text-gray-600">(Default if prompt has lighting)</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {ATMOSPHERE_PRESETS.map((a) => (
                      <button
                        key={a.label}
                        type="button"
                        onClick={() => setAtmosphere(atmosphere === a.label && a.label !== "Default" ? "Default" : a.label)}
                        disabled={isGenerating}
                        className={`rounded px-2 py-1 text-xs transition ${
                          atmosphere === a.label
                            ? "bg-blue-600/50 text-white"
                            : "bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-gray-300"
                        } disabled:opacity-50`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs text-gray-500">
                    Image-to-world (optional) ·{" "}
                    <button
                      type="button"
                      onClick={() => setImageUrl(SAMPLE_IMAGE_URL)}
                      disabled={isGenerating}
                      className="text-blue-400 hover:text-blue-300 disabled:opacity-50"
                    >
                      try sample
                    </button>
                  </label>
                  <div
                    className={`rounded-lg border border-dashed border-gray-700 bg-gray-800/50 p-2 transition ${!isGenerating ? "hover:border-gray-600" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const f = e.dataTransfer.files[0];
                      if (f && f.type.startsWith("image/") && !isGenerating) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          const data = reader.result as string;
                          if (data.length < 15_000_000) setImageUrl(data);
                          else setStatus("Image too large; use a URL or smaller file");
                        };
                        reader.readAsDataURL(f);
                      }
                    }}
                  >
                    <input
                      type="url"
                      value={imageUrl.startsWith("data:") ? "" : imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      onPaste={(e) => {
                        const item = e.clipboardData.items.find((i) => i.type.startsWith("image/"));
                        if (item && !isGenerating) {
                          const f = item.getAsFile();
                          if (f) {
                            e.preventDefault();
                            const reader = new FileReader();
                            reader.onload = () => {
                              const data = reader.result as string;
                              if (data.length < 15_000_000) setImageUrl(data);
                              else setStatus("Image too large; use smaller image");
                            };
                            reader.readAsDataURL(f);
                          }
                        }
                      }}
                      placeholder="Paste URL or image (Ctrl+V)"
                      className="w-full bg-transparent p-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                      disabled={isGenerating}
                    />
                    <div className="flex items-center gap-2 px-2">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        id="image-upload"
                        disabled={isGenerating}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              const data = reader.result as string;
                              if (data.length < 15_000_000) setImageUrl(data);
                              else setStatus("Image too large; use URL or smaller file");
                            };
                            reader.readAsDataURL(f);
                          }
                          e.target.value = "";
                        }}
                      />
                      <label
                        htmlFor="image-upload"
                        className={`cursor-pointer text-xs text-gray-500 ${!isGenerating ? "hover:text-gray-400" : ""}`}
                      >
                        or choose file
                      </label>
                      {imageUrl.trim() && (
                        <>
                          {imageUrl.startsWith("data:") && (
                            <span className="text-xs text-green-500/80">✓ Image loaded</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setImageUrl("")}
                            className="text-xs text-gray-500 hover:text-red-400"
                          >
                            Clear
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {imageUrl.trim() && (
                    <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs text-gray-400">
                      <input
                        type="checkbox"
                        checked={isPano}
                        onChange={(e) => setIsPano(e.target.checked)}
                        disabled={isGenerating}
                        className="rounded border-gray-600"
                      />
                      360° panoramic image
                    </label>
                  )}
                </div>
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Model:</span>
                    {marbleModel === "mini" && (
                      <span className="text-xs text-amber-400">· mini often yields blob-like results</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                      plus (best quality, ~2–3min)
                    </button>
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
                  </div>
                </div>
                <button
                  onClick={handleSimpleGenerate}
                  disabled={isGenerating || (config !== null && !config.hasWorldLabs)}
                  className="mt-4 w-full rounded-lg bg-blue-600 py-3 font-semibold shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 hover:shadow-blue-600/40 disabled:bg-gray-700 disabled:shadow-none"
                >
                  {isGenerating
                    ? marbleModel === "plus"
                      ? `⏳ Generating... ${elapsedSec}s`
                      : `⏳ Generating... ${elapsedSec}s`
                    : config && !config.hasWorldLabs
                      ? "Add WORLDLABS_API_KEY to .env"
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
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      href={`https://marble.worldlabs.ai/world/${world.world_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600/20 px-3 py-1.5 text-sm font-medium text-blue-400 transition hover:bg-blue-600/30"
                    >
                      Open in Marble Viewer →
                    </a>
                    {marbleModel === "mini" && !isGenerating && (
                      <button
                        type="button"
                        onClick={() => {
                          setMarbleModel("plus");
                          setTimeout(handleSimpleGenerate, 0);
                        }}
                        className="rounded-lg bg-amber-600/30 px-3 py-1.5 text-sm font-medium text-amber-200 transition hover:bg-amber-600/50"
                      >
                        Regenerate with plus (better quality)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        const url = `https://marble.worldlabs.ai/world/${world.world_id}`;
                        await navigator.clipboard.writeText(url);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="rounded-lg bg-gray-700/80 px-2 py-1.5 text-xs text-gray-400 transition hover:bg-gray-600 hover:text-white"
                    >
                      {copied ? "✓ Copied" : "Copy link"}
                    </button>
                  </div>
                )}
                {status.startsWith("Error") && (
                  <button
                    type="button"
                    onClick={handleSimpleGenerate}
                    className="mt-3 rounded-lg bg-amber-600/30 px-3 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-600/50"
                  >
                    ↩ Retry
                  </button>
                )}
              </div>
            </div>
            <div ref={viewerRef} className="relative overflow-hidden rounded-xl border border-gray-800 bg-gray-900/80">
              {world && (
                <button
                  type="button"
                  onClick={() => {
                    if (viewerRef.current) {
                      viewerRef.current.requestFullscreen?.() ??
                        (viewerRef.current as HTMLElement & { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen?.();
                    }
                  }}
                  className="absolute right-3 top-3 z-10 rounded-lg bg-black/60 px-3 py-2 text-sm text-white/90 backdrop-blur-sm transition hover:bg-black/80"
                  title="Full screen"
                >
                  ⛶ Full screen
                </button>
              )}
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
                  {isRunning ? `⏳ Agents Working... ${agentElapsedSec}s` : "🚀 Launch Agents"}
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
              <div
                ref={agentViewerRef}
                className="relative overflow-hidden rounded-xl border border-gray-800 bg-gray-900/80"
                style={{ minHeight: 400 }}
              >
                {worlds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const el = agentViewerRef.current;
                      if (el) el.requestFullscreen?.() ?? (el as HTMLElement & { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen?.();
                    }}
                    className="absolute right-3 top-3 z-10 rounded-lg bg-black/60 px-3 py-2 text-sm text-white/90 backdrop-blur-sm transition hover:bg-black/80"
                    title="Full screen"
                  >
                    ⛶ Full screen
                  </button>
                )}
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
                <div ref={activityFeedRef} className="max-h-48 space-y-1 overflow-y-auto">
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
                  <div className="space-y-2">
                    {worlds.map((w, i) => {
                      const url = `https://marble.worldlabs.ai/world/${w.worldId}`;
                      return (
                        <div
                          key={w.worldId}
                          className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition hover:bg-gray-800/50"
                        >
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 text-sm text-blue-400 transition hover:text-blue-300"
                          >
                            🌍 World {i + 1} ({w.agentName}): {w.worldId.slice(0, 12)}...
                          </a>
                          <button
                            type="button"
                            onClick={async () => {
                              await navigator.clipboard.writeText(url);
                              setCopiedWorldId(w.worldId);
                              setTimeout(() => setCopiedWorldId(null), 2000);
                            }}
                            className="shrink-0 rounded px-2 py-0.5 text-xs text-gray-400 transition hover:bg-gray-600 hover:text-white"
                          >
                            {copiedWorldId === w.worldId ? "✓ Copied" : "Copy"}
                          </button>
                        </div>
                      );
                    })}
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
