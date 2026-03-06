import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";

export function resolveRequestId(request: Request): string {
  const header = request.headers.get(REQUEST_ID_HEADER)?.trim();
  return header || randomUUID();
}

