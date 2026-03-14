import { NextRequest } from "next/server";
import { runOrchestrator } from "@/lib/orchestrator";

export const maxDuration = 300;

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  let body: { command?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const command = body.command?.trim();
  if (!command) {
    return new Response(JSON.stringify({ error: "Missing command" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await runOrchestrator(command, (event) => {
          controller.enqueue(encoder.encode(sseEvent(event)));
        });
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            sseEvent({
              type: "error",
              data: { message: err instanceof Error ? err.message : "Orchestrator failed" },
            })
          )
        );
        controller.enqueue(encoder.encode(sseEvent({ type: "done" })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
