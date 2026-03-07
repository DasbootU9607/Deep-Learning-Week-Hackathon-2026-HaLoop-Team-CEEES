import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { attachActorHeaders, ACTOR_ID_HEADER, ACTOR_NAME_HEADER, ACTOR_ROLE_HEADER, AUTH_INVALID_HEADER } from "@/lib/server/auth";

const REQUEST_ID_HEADER = "x-request-id";

export function middleware(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  const requestId = requestHeaders.get(REQUEST_ID_HEADER)?.trim() || crypto.randomUUID();
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  requestHeaders.delete(ACTOR_ID_HEADER);
  requestHeaders.delete(ACTOR_NAME_HEADER);
  requestHeaders.delete(ACTOR_ROLE_HEADER);
  requestHeaders.delete(AUTH_INVALID_HEADER);
  attachActorHeaders(requestHeaders, request);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  const actorId = requestHeaders.get(ACTOR_ID_HEADER);
  const actorName = requestHeaders.get(ACTOR_NAME_HEADER);
  const actorRole = requestHeaders.get(ACTOR_ROLE_HEADER);
  const authInvalid = requestHeaders.get(AUTH_INVALID_HEADER);

  if (actorId && actorName && actorRole) {
    response.headers.set(ACTOR_ID_HEADER, actorId);
    response.headers.set(ACTOR_NAME_HEADER, actorName);
    response.headers.set(ACTOR_ROLE_HEADER, actorRole);
  }
  if (authInvalid) {
    response.headers.set(AUTH_INVALID_HEADER, authInvalid);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
