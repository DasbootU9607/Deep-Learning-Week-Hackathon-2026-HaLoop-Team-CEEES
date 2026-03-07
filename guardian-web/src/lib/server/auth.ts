import { findDemoActorByToken } from "@/lib/demoActors";
import { Policy, RolePermission, RoleType } from "@/types/policy";

export const ACTOR_ID_HEADER = "x-haloop-actor-id";
export const ACTOR_NAME_HEADER = "x-haloop-actor-name";
export const ACTOR_ROLE_HEADER = "x-haloop-actor-role";
export const AUTH_INVALID_HEADER = "x-haloop-auth-invalid";

export interface AuthenticatedActor {
  id: string;
  name: string;
  role: RoleType;
}

export class AuthError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

type PermissionName = "approve" | "reject" | "configure_policy" | "toggle_incident";

export function resolveAuthenticatedActor(request: Request): AuthenticatedActor | undefined {
  if (request.headers.get(AUTH_INVALID_HEADER) === "true") {
    throw new AuthError("Invalid bearer token for HaLoop demo auth.", 401);
  }

  const actorId = request.headers.get(ACTOR_ID_HEADER)?.trim();
  const actorName = request.headers.get(ACTOR_NAME_HEADER)?.trim();
  const actorRole = request.headers.get(ACTOR_ROLE_HEADER)?.trim() as RoleType | undefined;

  if (actorId && actorName && actorRole) {
    return {
      id: actorId,
      name: actorName,
      role: actorRole,
    };
  }

  const tokenActor = findDemoActorByToken(readBearerToken(request.headers));
  if (!tokenActor) {
    return undefined;
  }

  return {
    id: tokenActor.id,
    name: tokenActor.name,
    role: tokenActor.role,
  };
}

export function requireAuthenticatedActor(request: Request): AuthenticatedActor {
  const actor = resolveAuthenticatedActor(request);
  if (!actor) {
    throw new AuthError("Authentication required. Select a demo actor before mutating state.", 401);
  }
  return actor;
}

export function requirePermission(
  request: Request,
  policy: Policy,
  permission: PermissionName,
): AuthenticatedActor {
  const actor = requireAuthenticatedActor(request);
  const rolePermission = getRolePermission(policy, actor.role);

  if (!hasPermission(rolePermission, permission)) {
    throw new AuthError(`Role ${actor.role} is not allowed to ${permission.replace(/_/g, " ")}.`, 403);
  }

  return actor;
}

export function attachActorHeaders(headers: Headers, request: Request): void {
  const actor = findDemoActorByToken(readBearerToken(request.headers));
  if (!actor) {
    if (request.headers.get("authorization")) {
      headers.set(AUTH_INVALID_HEADER, "true");
    }
    return;
  }

  headers.set(ACTOR_ID_HEADER, actor.id);
  headers.set(ACTOR_NAME_HEADER, actor.name);
  headers.set(ACTOR_ROLE_HEADER, actor.role);
}

function getRolePermission(policy: Policy, role: RoleType): RolePermission | undefined {
  return policy.role_permissions.find((permission) => permission.role === role);
}

function hasPermission(permission: RolePermission | undefined, name: PermissionName): boolean {
  if (!permission) {
    return false;
  }

  switch (name) {
    case "approve":
      return permission.can_approve;
    case "reject":
      return permission.can_reject;
    case "configure_policy":
      return permission.can_configure_policy;
    case "toggle_incident":
      return permission.can_toggle_incident;
  }
}

function readBearerToken(headers: Headers): string | undefined {
  const authorization = headers.get("authorization")?.trim();
  if (!authorization) {
    return undefined;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}
