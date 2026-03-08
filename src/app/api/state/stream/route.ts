import { getState } from "@/lib/store";

export const runtime = "edge";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial state immediately
      const state = await getState();
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(state)}\n\n`)
      );

      // Poll for changes and push updates
      const interval = setInterval(async () => {
        try {
          const current = await getState();
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(current)}\n\n`)
          );
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 1000);

      // Clean up on abort
      const cleanup = () => {
        clearInterval(interval);
        controller.close();
      };

      // The stream will be closed when the client disconnects
      setTimeout(cleanup, 5 * 60 * 1000); // 5-minute max lifetime
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
