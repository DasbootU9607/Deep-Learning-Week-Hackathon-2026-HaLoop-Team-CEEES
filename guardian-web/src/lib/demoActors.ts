import { RoleType } from "@/types/policy";

export interface DemoActor {
  token: string;
  id: string;
  name: string;
  role: RoleType;
  label: string;
}

export const DEMO_ACTORS: DemoActor[] = [
  {
    token: "haloop-admin-token",
    id: "haloop-admin",
    name: "Avery Admin",
    role: "admin",
    label: "Admin",
  },
  {
    token: "haloop-lead-token",
    id: "haloop-lead",
    name: "Lina Lead",
    role: "lead",
    label: "Lead",
  },
  {
    token: "haloop-developer-token",
    id: "haloop-developer",
    name: "Devon Developer",
    role: "developer",
    label: "Developer",
  },
  {
    token: "haloop-viewer-token",
    id: "haloop-viewer",
    name: "Vera Viewer",
    role: "viewer",
    label: "Viewer",
  },
];

export const DEFAULT_DEMO_ACTOR = DEMO_ACTORS[1];

export function findDemoActorByToken(token: string | null | undefined): DemoActor | undefined {
  if (!token) {
    return undefined;
  }
  return DEMO_ACTORS.find((actor) => actor.token === token.trim());
}
