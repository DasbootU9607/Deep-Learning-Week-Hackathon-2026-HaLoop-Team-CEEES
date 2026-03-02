import { getApprovalDecision } from "@/lib/server/dataStore";

export const runtime = "nodejs";

const HEARTBEAT_MS = 15_000;
const POLL_MS = 1_000;
const STREAM_TIMEOUT_MS = 10 * 60 * 1000;

interface Params {
  params: { approvalId: string };
}

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const encoder = new TextEncoder();
  const approvalId = params.approvalId;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let active = true;
      let pollTimer: NodeJS.Timeout | undefined;
      let heartbeatTimer: NodeJS.Timeout | undefined;
      let timeoutTimer: NodeJS.Timeout | undefined;

      const cleanup = (): void => {
        active = false;
        if (pollTimer) {
          clearInterval(pollTimer);
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
        }
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
        }
      };

      const sendDecision = async (): Promise<void> => {
        if (!active) {
          return;
        }

        const decision = await getApprovalDecision(approvalId);
        if (!decision) {
          return;
        }

        controller.enqueue(encoder.encode(`event: decision\ndata: ${JSON.stringify(decision)}\n\n`));
        cleanup();
        controller.close();
      };

      void sendDecision();

      heartbeatTimer = setInterval(() => {
        if (!active) {
          return;
        }
        controller.enqueue(encoder.encode(`: keep-alive ${Date.now()}\n\n`));
      }, HEARTBEAT_MS);

      pollTimer = setInterval(() => {
        void sendDecision();
      }, POLL_MS);

      timeoutTimer = setTimeout(() => {
        if (!active) {
          return;
        }
        cleanup();
        controller.close();
      }, STREAM_TIMEOUT_MS);

      request.signal.addEventListener("abort", () => {
        if (!active) {
          return;
        }
        cleanup();
        controller.close();
      });
    },
    cancel() {
      // Stream cleanup handled by timers and abort listener.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
