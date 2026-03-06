import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { REQUEST_ID_HEADER, resolveRequestId } from "@/lib/server/requestId";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = resolveRequestId(request);
  const secret = process.env.OPENAI_WEBHOOK_SECRET?.trim();

  if (!secret) {
    const response = NextResponse.json(
      { error: "OPENAI_WEBHOOK_SECRET is not configured.", requestId },
      { status: 501 },
    );
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }

  try {
    const rawBody = await request.text();
    if (!verifySignature(rawBody, request.headers, secret)) {
      const response = NextResponse.json(
        { error: "Invalid webhook signature.", requestId },
        { status: 401 },
      );
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    }

    const payload = safeParseJson(rawBody);
    const eventType = String(payload?.type ?? "unknown");

    // Event persistence can be forwarded into audit storage if needed.
    const response = NextResponse.json({
      ok: true,
      eventType,
      requestId,
    });
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        requestId,
      },
      { status: 400 },
    );
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }
}

function verifySignature(body: string, headers: Headers, secret: string): boolean {
  const signatureHeader =
    headers.get("x-openai-signature")?.trim() || headers.get("openai-signature")?.trim();

  if (!signatureHeader) {
    return false;
  }

  const provided = normalizeSignature(signatureHeader);
  const expected = createHmac("sha256", secret).update(body).digest("hex");

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

function normalizeSignature(signature: string): string {
  const trimmed = signature.trim();
  if (trimmed.startsWith("sha256=")) {
    return trimmed.slice("sha256=".length);
  }
  return trimmed;
}

function safeParseJson(raw: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

