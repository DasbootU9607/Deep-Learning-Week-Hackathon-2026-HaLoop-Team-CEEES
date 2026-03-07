export type BackendMode = "demo" | "prod";
export interface RuntimeModeSummary {
  mode: BackendMode;
  queueEnabled: boolean;
  datastore: "demo-json" | "prisma-postgres";
}

let cachedMode: BackendMode | undefined;

export function getBackendMode(): BackendMode {
  if (cachedMode) {
    return cachedMode;
  }

  const raw = String(process.env.BACKEND_MODE ?? "demo").trim().toLowerCase();
  cachedMode = raw === "prod" ? "prod" : "demo";
  return cachedMode;
}

export function isProdBackendMode(): boolean {
  return getBackendMode() === "prod";
}

export function isQueueConfiguredForRuntime(): boolean {
  return isProdBackendMode() && Boolean(process.env.REDIS_URL?.trim());
}

export function getRuntimeModeSummary(): RuntimeModeSummary {
  const mode = getBackendMode();
  return {
    mode,
    queueEnabled: isQueueConfiguredForRuntime(),
    datastore: mode === "prod" ? "prisma-postgres" : "demo-json",
  };
}

export function resetBackendModeCacheForTests(): void {
  cachedMode = undefined;
}
