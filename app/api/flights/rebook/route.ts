import { NextRequest } from "next/server";
import { runFlightAgent } from "@/lib/flightAgent";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const { bookingRef } = await request.json();

  if (!bookingRef) {
    return new Response(JSON.stringify({ error: "bookingRef required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Stream agent events as newline-delimited JSON (NDJSON)
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        for await (const event of runFlightAgent(bookingRef)) {
          const line = JSON.stringify(event) + "\n";
          controller.enqueue(encoder.encode(line));
        }
      } catch (err) {
        const errorEvent = JSON.stringify({
          type: "error",
          message: err instanceof Error ? err.message : "Agent error",
        }) + "\n";
        controller.enqueue(encoder.encode(errorEvent));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
