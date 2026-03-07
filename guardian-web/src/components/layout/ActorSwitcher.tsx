"use client";

import { DEMO_ACTORS } from "@/lib/demoActors";
import { useDemoActor } from "@/lib/demoActorClient";

export function ActorSwitcher() {
  const { actor, setActorToken } = useDemoActor();

  return (
    <label className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 md:flex">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Acting as
      </span>
      <select
        className="bg-transparent text-sm text-foreground outline-none"
        value={actor.token}
        onChange={(event) => setActorToken(event.target.value)}
      >
        {DEMO_ACTORS.map((candidate) => (
          <option key={candidate.token} value={candidate.token}>
            {candidate.name} ({candidate.role})
          </option>
        ))}
      </select>
    </label>
  );
}
