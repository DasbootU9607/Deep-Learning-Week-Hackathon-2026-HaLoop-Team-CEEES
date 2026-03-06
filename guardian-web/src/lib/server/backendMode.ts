export type BackendMode = "demo" | "prod";

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

export function resetBackendModeCacheForTests(): void {
  cachedMode = undefined;
}
