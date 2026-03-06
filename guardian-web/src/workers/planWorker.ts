import { createPlanWorker, isPlanQueueEnabled } from "@/lib/server/planQueue";

async function main(): Promise<void> {
  if (!isPlanQueueEnabled()) {
    throw new Error("Plan worker requires BACKEND_MODE=prod and REDIS_URL.");
  }

  const worker = createPlanWorker();
  worker.on("ready", () => {
    console.log("[plan-worker] ready");
  });
  worker.on("completed", (job) => {
    console.log(`[plan-worker] completed job=${job.id}`);
  });
  worker.on("failed", (job, error) => {
    console.error(`[plan-worker] failed job=${job?.id ?? "unknown"} reason=${error.message}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[plan-worker] shutting down on ${signal}`);
    await worker.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void main().catch((error) => {
  console.error(`[plan-worker] startup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

