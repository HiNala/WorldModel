"use client";

import type { Agent } from "@/lib/agents";

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-gray-600",
  thinking: "bg-yellow-500 animate-pulse",
  working: "bg-blue-500 animate-pulse",
  done: "bg-green-500",
  error: "bg-red-500",
};

const ROLE_EMOJI: Record<string, string> = {
  orchestrator: "🧠",
  terrain: "🏔️",
  architect: "🏗️",
  narrator: "📖",
  lighting: "💡",
  scout: "🔍",
};

export function AgentPanel({ agent }: { agent: Agent }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{ROLE_EMOJI[agent.role] ?? "🤖"}</span>
          <span className="font-semibold">{agent.name}</span>
        </div>
        <span
          className={`rounded-md px-2.5 py-1 text-xs font-medium text-white ${STATUS_COLORS[agent.status] ?? "bg-gray-600"}`}
        >
          {agent.status}
        </span>
      </div>

      {agent.task && (
        <div className="mb-2 text-sm text-gray-400">Task: {agent.task}</div>
      )}

      {agent.worldId && (
        <a
          href={`https://marble.worldlabs.ai/world/${agent.worldId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 inline-flex items-center gap-1 rounded-lg bg-blue-600/20 px-2 py-1 text-xs font-medium text-blue-400 transition hover:bg-blue-600/30"
        >
          View Generated World →
        </a>
      )}

      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
        {agent.logs.slice(-8).map((entry, i) => (
          <div key={i} className="text-xs">
            <span
              className={
                entry.type === "error"
                  ? "text-red-400"
                  : entry.type === "spawn"
                    ? "text-purple-400"
                    : entry.type === "result"
                      ? "text-green-400"
                      : entry.type === "action"
                        ? "text-blue-400"
                        : "text-gray-500"
              }
            >
              [{entry.type}]
            </span>{" "}
            <span className="text-gray-300">{entry.text.slice(0, 120)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
