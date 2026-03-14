export type AgentRole =
  | "orchestrator"
  | "terrain"
  | "architect"
  | "narrator"
  | "lighting"
  | "scout";
export type AgentStatus = "idle" | "thinking" | "working" | "done" | "error";

export interface LogEntry {
  time: number;
  type: "thought" | "action" | "result" | "error" | "spawn";
  text: string;
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  task: string | null;
  worldId: string | null;
  logs: LogEntry[];
  parentId: string | null;
}
