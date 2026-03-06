import OpenAI from "openai";
import { GeneratePlanRequest, GeneratePlanResponse, generatePlanResponseSchema } from "@/lib/server/contracts";
import { Policy } from "@/types/policy";
import { withSpan } from "@/lib/server/tracing";

const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["planId", "summary", "changes", "proposedCommands", "backendRisk"],
  properties: {
    planId: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    changes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "action"],
        properties: {
          path: { type: "string", minLength: 1 },
          action: { type: "string", enum: ["create", "update", "delete"] },
          newContent: { type: "string" },
          oldContentHash: { type: "string" },
        },
      },
    },
    proposedCommands: {
      type: "array",
      items: { type: "string" },
    },
    backendRisk: {
      type: "object",
      additionalProperties: false,
      required: ["score", "level", "reasons"],
      properties: {
        score: { type: "number", minimum: 0, maximum: 100 },
        level: { type: "string", enum: ["low", "medium", "high"] },
        reasons: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  },
} as const;

export function isOpenAIPlannerEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function generatePlanWithReliability(params: {
  request: GeneratePlanRequest;
  policy: Policy;
  requestId?: string;
  preferBackground?: boolean;
}): Promise<GeneratePlanResponse> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to use OpenAI planning.");
  }

  const client = new OpenAI({
    apiKey,
  });

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  const maxAttempts = boundedInt(process.env.OPENAI_MAX_ATTEMPTS, 1, 8, 4);
  const shouldBackground = params.preferBackground ?? shouldUseBackgroundMode(params.request.prompt);

  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      const parsed = await withSpan(
        "openai.plan.request",
        {
          "request.id": params.requestId ?? "",
          "openai.model": model,
          "openai.attempt": attempt,
          "openai.background": shouldBackground,
        },
        async () => {
          const response = await client.responses.create({
            model,
            background: shouldBackground,
            input: [
              {
                role: "system",
                content: [
                  {
                    type: "input_text",
                    text: buildSystemPrompt(params.policy),
                  },
                ],
              },
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: JSON.stringify(params.request),
                  },
                ],
              },
            ],
            text: {
              format: {
                type: "json_schema",
                name: "generate_plan_response",
                schema: PLAN_SCHEMA,
                strict: true,
              },
            },
            metadata: {
              request_id: params.requestId ?? "",
              session_id: params.request.sessionId,
              planner_mode: "reliable",
            },
          } as never);

          const finalized = shouldBackground
            ? await pollBackgroundResponse(client, response.id, params.requestId)
            : response;

          return parseStructuredOutput(finalized);
        },
      );

      return generatePlanResponseSchema.parse(parsed);
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error, attempt, maxAttempts)) {
        break;
      }
      await sleep(backoffMs(attempt));
    }
  }

  throw new Error(`OpenAI planning failed after ${maxAttempts} attempt(s): ${toErrorMessage(lastError)}`);
}

export function shouldUseBackgroundMode(prompt: string): boolean {
  return prompt.trim().length >= 240;
}

async function pollBackgroundResponse(
  client: OpenAI,
  responseId: string | undefined,
  requestId?: string,
): Promise<unknown> {
  if (!responseId) {
    throw new Error("OpenAI background response did not include a response ID.");
  }

  const maxPolls = boundedInt(process.env.OPENAI_BACKGROUND_MAX_POLLS, 3, 120, 40);
  for (let poll = 1; poll <= maxPolls; poll += 1) {
    const response = await client.responses.retrieve(responseId);
    const status = String((response as { status?: string }).status ?? "");

    if (status === "completed") {
      return response;
    }

    if (status === "failed" || status === "cancelled" || status === "incomplete") {
      throw new Error(
        `OpenAI background response ${responseId} ended with status=${status} (requestId=${requestId ?? "n/a"}).`,
      );
    }

    await sleep(Math.min(15000, 600 + poll * 250));
  }

  throw new Error(`OpenAI background response timed out for ${responseId} (requestId=${requestId ?? "n/a"}).`);
}

function parseStructuredOutput(raw: unknown): unknown {
  const payload = raw as {
    output_text?: unknown;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string; value?: string }>;
    }>;
  };

  const outputText = typeof payload.output_text === "string" ? payload.output_text.trim() : "";
  if (outputText) {
    return JSON.parse(outputText);
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      const candidate = typeof content.text === "string" ? content.text : content.value;
      if (!candidate || typeof candidate !== "string") {
        continue;
      }

      const trimmed = candidate.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        return JSON.parse(trimmed);
      }
    }
  }

  throw new Error("OpenAI response did not include structured JSON output.");
}

function shouldRetry(error: unknown, attempt: number, maxAttempts: number): boolean {
  if (attempt >= maxAttempts) {
    return false;
  }

  const status = Number((error as { status?: unknown })?.status);
  if (Number.isFinite(status) && RETRYABLE_STATUS.has(status)) {
    return true;
  }

  const code = String((error as { code?: unknown })?.code ?? "");
  if (code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ENOTFOUND") {
    return true;
  }

  return false;
}

function backoffMs(attempt: number): number {
  const cappedAttempt = Math.max(1, Math.min(attempt, 8));
  const base = 350 * 2 ** (cappedAttempt - 1);
  const jitter = Math.floor(Math.random() * 180);
  return Math.min(8000, base + jitter);
}

function buildSystemPrompt(policy: Policy): string {
  return [
    "You are a backend planning engine for safe AI code changes.",
    "Return ONLY JSON that matches the provided schema.",
    "Use policy path rules and thresholds to score risk.",
    `Policy JSON: ${JSON.stringify(policy)}`,
    "Set backendRisk.reasons with concise, actionable statements.",
  ].join("\n");
}

function boundedInt(value: string | undefined, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
