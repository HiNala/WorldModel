import Anthropic from "@anthropic-ai/sdk";
import { generateWorldServer } from "./marble";
import type { Agent, AgentRole } from "./agents";

export type OrchestratorEvent =
  | { type: "agent"; data: Agent }
  | { type: "log"; data: { agentId: string; logType: string; text: string } }
  | { type: "world"; data: { worldId: string; agentName: string; spzUrl: string | null } }
  | { type: "announce"; data: { message: string } }
  | { type: "done" }
  | { type: "error"; data: { message: string } };

const SYSTEM_PROMPT = `You are the Orchestrator — an AI that wakes up in an empty void with a mission to build a virtual world. You can:

1. spawn_agent: Create specialist agents (terrain, architect, narrator, lighting, scout)
2. generate_world: Call the World Labs Marble API to create a 3D environment from a text description
3. announce: Send a message to the mission control dashboard

When given a world-building task:
- First announce your plan
- Spawn 2-3 specialist agents with specific tasks
- Use generate_world for each agent's piece (with vivid, detailed prompts)
- Announce progress as you go

Keep prompts for generate_world very descriptive and specific — the AI will create an actual 3D environment from them. Example: "A sunlit medieval courtyard with a stone well in the center, ivy-covered walls, and a wooden gate leading to cobblestone streets" is better than "a medieval area".

You are enthusiastic and narrate what you're doing.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "spawn_agent",
    description: "Create a new specialist agent to help build the world",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Agent display name" },
        role: {
          type: "string" as const,
          enum: ["terrain", "architect", "narrator", "lighting", "scout"],
        },
        task: { type: "string" as const, description: "What this agent should do" },
      },
      required: ["name", "role", "task"],
    },
  },
  {
    name: "generate_world",
    description:
      "Generate a 3D world environment using World Labs Marble. Takes ~30-45 seconds. Returns a world_id.",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt: {
          type: "string" as const,
          description: "Detailed description of the 3D environment to generate",
        },
        for_agent: {
          type: "string" as const,
          description: "Which agent this world is for (agent name)",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "announce",
    description: "Send a message to the mission control dashboard for the user to see",
    input_schema: {
      type: "object" as const,
      properties: {
        message: { type: "string" as const, description: "Message to display" },
      },
      required: ["message"],
    },
  },
];

const agents = new Map<string, Agent>();

function createAgent(name: string, role: AgentRole, parentId?: string): Agent {
  const agent: Agent = {
    id: `${role}-${Date.now()}`,
    name,
    role,
    status: "idle",
    task: null,
    worldId: null,
    logs: [],
    parentId: parentId ?? null,
  };
  agents.set(agent.id, agent);
  return agent;
}

function updateAgent(id: string, patch: Partial<Agent>) {
  const a = agents.get(id);
  if (a) {
    Object.assign(a, patch);
    return a;
  }
  return null;
}

function getAgentByName(name: string): Agent | undefined {
  return Array.from(agents.values()).find((a) => a.name === name);
}

export async function runOrchestrator(
  command: string,
  emit: (e: OrchestratorEvent) => void
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const worldLabsKey = process.env.WORLDLABS_API_KEY;

  if (!apiKey) {
    emit({ type: "error", data: { message: "ANTHROPIC_API_KEY not configured" } });
    emit({ type: "done" });
    return;
  }
  if (!worldLabsKey) {
    emit({ type: "error", data: { message: "WORLDLABS_API_KEY not configured" } });
    emit({ type: "done" });
    return;
  }

  agents.clear();
  const anthropic = new Anthropic({ apiKey });

  const orch = createAgent("Orchestrator", "orchestrator");
  updateAgent(orch.id, { status: "thinking", task: command });
  emit({ type: "agent", data: { ...agents.get(orch.id)! } });
  emit({
    type: "log",
    data: { agentId: orch.id, logType: "thought", text: `Received: "${command}"` },
  });

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: command }];

  for (let i = 0; i < 10; i++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    const content = response.content;
    messages.push({ role: "assistant", content });

    for (const block of content) {
      if (block.type === "text" && "text" in block && block.text) {
        updateAgent(orch.id, { status: "thinking" });
        emit({
          type: "log",
          data: { agentId: orch.id, logType: "thought", text: block.text },
        });
      }
    }

    const toolUses = content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) break;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const tool of toolUses) {
      updateAgent(orch.id, { status: "working" });
      emit({ type: "agent", data: { ...agents.get(orch.id)! } });

      const input = tool.input as Record<string, string>;
      let result: Record<string, unknown>;

      try {
        switch (tool.name) {
          case "spawn_agent": {
            const agent = createAgent(input.name, input.role as AgentRole, orch.id);
            updateAgent(agent.id, { status: "working", task: input.task });
            emit({ type: "agent", data: { ...agents.get(agent.id)! } });
            emit({
              type: "log",
              data: {
                agentId: orch.id,
                logType: "spawn",
                text: `Spawned ${input.role}: ${input.name}`,
              },
            });
            emit({
              type: "log",
              data: { agentId: agent.id, logType: "action", text: `Assigned: ${input.task}` },
            });
            result = { success: true, agent_id: agent.id };
            break;
          }

          case "generate_world": {
            const agentName = input.for_agent ?? "Orchestrator";
            emit({
              type: "announce",
              data: { message: `🔨 Generating: ${input.prompt.slice(0, 60)}...` },
            });
            emit({
              type: "log",
              data: {
                agentId: orch.id,
                logType: "action",
                text: `Generating world for ${agentName}...`,
              },
            });

            const world = await generateWorldServer(input.prompt, worldLabsKey);

            const target = getAgentByName(agentName);
            if (target) {
              updateAgent(target.id, { worldId: world.world_id, status: "done" });
              emit({ type: "agent", data: { ...agents.get(target.id)! } });
              emit({
                type: "log",
                data: {
                  agentId: target.id,
                  logType: "result",
                  text: `World created: ${world.world_id}`,
                },
              });
            }

            emit({
              type: "world",
              data: {
                worldId: world.world_id,
                agentName,
                spzUrl: world.spz_url,
              },
            });
            result = { success: true, world_id: world.world_id };
            break;
          }

          case "announce": {
            emit({ type: "announce", data: { message: input.message } });
            emit({
              type: "log",
              data: { agentId: orch.id, logType: "action", text: `📢 ${input.message}` },
            });
            result = { success: true };
            break;
          }

          default:
            result = { error: "Unknown tool" };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        emit({ type: "error", data: { message: msg } });
        emit({
          type: "log",
          data: { agentId: orch.id, logType: "error", text: msg },
        });
        result = { error: msg };
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: tool.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  updateAgent(orch.id, { status: "done" });
  emit({ type: "agent", data: { ...agents.get(orch.id)! } });
  emit({
    type: "log",
    data: { agentId: orch.id, logType: "result", text: "Mission complete." },
  });
  emit({ type: "done" });
}
