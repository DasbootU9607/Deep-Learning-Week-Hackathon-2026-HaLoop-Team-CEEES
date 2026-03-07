"use client";

import { useEffect, useState } from "react";
import { DEFAULT_DEMO_ACTOR, findDemoActorByToken } from "@/lib/demoActors";

export const DEMO_ACTOR_STORAGE_KEY = "haloop-demo-actor-token";
const DEMO_ACTOR_EVENT = "haloop-demo-actor-change";

export function getStoredDemoActorToken(): string {
  if (typeof window === "undefined") {
    return DEFAULT_DEMO_ACTOR.token;
  }

  return window.localStorage.getItem(DEMO_ACTOR_STORAGE_KEY) ?? DEFAULT_DEMO_ACTOR.token;
}

export function setStoredDemoActorToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DEMO_ACTOR_STORAGE_KEY, token);
  window.dispatchEvent(new Event(DEMO_ACTOR_EVENT));
}

export function useDemoActor() {
  const [token, setToken] = useState(getStoredDemoActorToken);

  useEffect(() => {
    const sync = () => setToken(getStoredDemoActorToken());
    window.addEventListener("storage", sync);
    window.addEventListener(DEMO_ACTOR_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(DEMO_ACTOR_EVENT, sync);
    };
  }, []);

  const actor = findDemoActorByToken(token) ?? DEFAULT_DEMO_ACTOR;

  return {
    actor,
    setActorToken: (nextToken: string) => {
      setStoredDemoActorToken(nextToken);
      setToken(nextToken);
    },
  };
}
