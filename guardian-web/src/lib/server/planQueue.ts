import { Queue, QueueEvents, Worker, type JobsOptions, type Job } from "bullmq";
import { isProdBackendMode } from "@/lib/server/backendMode";
import { executePlanGeneration, PlanExecutionInput, PlanExecutionOutput } from "@/lib/server/planExecution";

const PLAN_QUEUE_NAME = "plan-generation";
const PLAN_DLQ_NAME = "plan-generation-dlq";

let cachedQueue: Queue | undefined;
let cachedDlq: Queue | undefined;
let cachedQueueEvents: QueueEvents | undefined;

export function isPlanQueueEnabled(): boolean {
  return isProdBackendMode() && Boolean(process.env.REDIS_URL?.trim());
}

export function getPlanQueue(): Queue {
  if (!isPlanQueueEnabled()) {
    throw new Error("Plan queue is disabled. Set BACKEND_MODE=prod and REDIS_URL.");
  }

  if (!cachedQueue) {
    cachedQueue = new Queue(PLAN_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: getDefaultJobOptions(),
    });
  }
  return cachedQueue;
}

export function getDeadLetterQueue(): Queue {
  if (!isPlanQueueEnabled()) {
    throw new Error("Plan queue is disabled. Set BACKEND_MODE=prod and REDIS_URL.");
  }

  if (!cachedDlq) {
    cachedDlq = new Queue(PLAN_DLQ_NAME, {
      connection: getRedisConnection(),
    });
  }
  return cachedDlq;
}

export function getPlanQueueEvents(): QueueEvents {
  if (!isPlanQueueEnabled()) {
    throw new Error("Plan queue is disabled. Set BACKEND_MODE=prod and REDIS_URL.");
  }

  if (!cachedQueueEvents) {
    cachedQueueEvents = new QueueEvents(PLAN_QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return cachedQueueEvents;
}

export async function enqueuePlanJob(payload: PlanExecutionInput): Promise<Job> {
  const queue = getPlanQueue();
  return queue.add("generate-plan", payload, {
    ...getDefaultJobOptions(),
    removeOnComplete: {
      age: 24 * 60 * 60,
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60,
      count: 5000,
    },
  });
}

export async function getPlanJobStatus(jobId: string): Promise<{
  status: string;
  result?: PlanExecutionOutput;
  failedReason?: string;
  requestId?: string;
}> {
  const queue = getPlanQueue();
  const job = await queue.getJob(jobId);
  if (!job) {
    return { status: "not_found" };
  }

  const state = await job.getState();
  const result = job.returnvalue as PlanExecutionOutput | undefined;
  const failedReason = job.failedReason || undefined;
  const requestId = String(job.data.requestId ?? "");

  return {
    status: state,
    result,
    failedReason,
    requestId: requestId || undefined,
  };
}

export function createPlanWorker(): Worker {
  if (!isPlanQueueEnabled()) {
    throw new Error("Plan queue is disabled. Set BACKEND_MODE=prod and REDIS_URL.");
  }

  const worker = new Worker(
    PLAN_QUEUE_NAME,
    async (job) =>
      executePlanGeneration({
        ...(job.data as PlanExecutionInput),
        requestId: String((job.data as PlanExecutionInput).requestId ?? job.id),
      }),
    {
      connection: getRedisConnection(),
      concurrency: boundedInt(process.env.PLAN_QUEUE_CONCURRENCY, 1, 12, 3),
    },
  );

  worker.on("failed", async (job, error) => {
    if (!job) {
      return;
    }

    const configuredAttempts = Math.max(1, job.opts.attempts ?? 1);
    if (job.attemptsMade < configuredAttempts) {
      return;
    }

    try {
      const dlq = getDeadLetterQueue();
      await dlq.add(
        "dead-letter",
        {
          jobId: job.id,
          queue: PLAN_QUEUE_NAME,
          name: job.name,
          data: job.data,
          failedReason: error.message,
          attemptsMade: job.attemptsMade,
          failedAt: new Date().toISOString(),
        },
        {
          removeOnComplete: {
            age: 14 * 24 * 60 * 60,
            count: 5000,
          },
        },
      );
    } catch {
      // Ignore DLQ write errors to avoid crashing worker process.
    }
  });

  return worker;
}

function getRedisConnection(): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  maxRetriesPerRequest: null;
  enableReadyCheck: true;
} {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    throw new Error("REDIS_URL is required for queue support.");
  }

  const parsed = new URL(redisUrl);
  const database = parsed.pathname?.replace("/", "");

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: database ? Number.parseInt(database, 10) : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
}

function getDefaultJobOptions(): JobsOptions {
  return {
    attempts: boundedInt(process.env.PLAN_QUEUE_ATTEMPTS, 1, 10, 4),
    backoff: {
      type: "exponential",
      delay: boundedInt(process.env.PLAN_QUEUE_BACKOFF_MS, 100, 30_000, 500),
    },
  };
}

function boundedInt(raw: string | undefined, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}
