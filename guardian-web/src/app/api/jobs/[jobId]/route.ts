import { NextResponse } from "next/server";
import { getPlanJobStatus, isPlanQueueEnabled } from "@/lib/server/planQueue";
import { REQUEST_ID_HEADER, resolveRequestId } from "@/lib/server/requestId";

export const runtime = "nodejs";

interface Params {
  params: { jobId: string };
}

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const requestId = resolveRequestId(request);

  try {
    if (!isPlanQueueEnabled()) {
      const response = NextResponse.json(
        { error: "Job queue is disabled.", requestId },
        { status: 503 },
      );
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    }

    const status = await getPlanJobStatus(params.jobId);
    if (status.status === "not_found") {
      const response = NextResponse.json({ error: "Job not found", requestId }, { status: 404 });
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    }

    const response = NextResponse.json({
      ...status,
      requestId: status.requestId ?? requestId,
    });
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        requestId,
      },
      { status: 500 },
    );
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}

