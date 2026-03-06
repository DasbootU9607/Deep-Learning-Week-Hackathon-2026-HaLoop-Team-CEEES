import { NextResponse } from "next/server";
import { z } from "zod";
import { executePlanGeneration } from "@/lib/server/planExecution";
import { enqueuePlanJob, isPlanQueueEnabled } from "@/lib/server/planQueue";
import { resolveRequestId, REQUEST_ID_HEADER } from "@/lib/server/requestId";

export const runtime = "nodejs";

const planRequestSchema = z.object({
  goal: z.string().trim().min(1),
  requestedBy: z.string().trim().min(1).optional(),
  workspaceRoot: z.string().trim().min(1).optional(),
  branch: z.string().trim().min(1).optional(),
  activeFile: z.string().trim().min(1).optional(),
  selectedText: z.string().optional(),
  openTabs: z.array(z.string()).optional(),
  async: z.boolean().optional(),
  provider: z.enum(["auto", "heuristic", "openai"]).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = resolveRequestId(request);
  try {
    const parsed = planRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      const response = NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    }

    const input = parsed.data;
    const shouldQueue =
      isPlanQueueEnabled() && (input.async === true || input.goal.trim().length >= 240);

    if (shouldQueue) {
      const job = await enqueuePlanJob({
        goal: input.goal,
        requestedBy: input.requestedBy,
        workspaceRoot: input.workspaceRoot,
        branch: input.branch,
        activeFile: input.activeFile,
        selectedText: input.selectedText,
        openTabs: input.openTabs,
        requestId,
        preferBackground: true,
        provider: input.provider,
      });

      const response = NextResponse.json(
        {
          jobId: String(job.id),
          status: "queued",
          statusUrl: `/api/jobs/${encodeURIComponent(String(job.id))}`,
          requestId,
        },
        { status: 202 },
      );
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    }

    const result = await executePlanGeneration({
      goal: input.goal,
      requestedBy: input.requestedBy,
      workspaceRoot: input.workspaceRoot,
      branch: input.branch,
      activeFile: input.activeFile,
      selectedText: input.selectedText,
      openTabs: input.openTabs,
      requestId,
      preferBackground: false,
      provider: input.provider,
    });

    const response = NextResponse.json(result);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: toErrorMessage(error), requestId },
      { status: 500 },
    );
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
