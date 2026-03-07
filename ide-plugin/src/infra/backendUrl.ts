import * as vscode from "vscode";

type LoggerLike = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

export const DEFAULT_BACKEND_URL = "http://localhost:3000";

const DEFAULT_CANDIDATES = [DEFAULT_BACKEND_URL, "http://127.0.0.1:3000"];
const PROBE_PATH = "/api/incident";
// Next.js dev routes can take a few seconds to warm up on first request.
const PROBE_TIMEOUT_MS = 5000;

let cachedResolvedBackendUrl: string | undefined;

export function normalizeBackendUrl(value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  if (trimmed.endsWith("/api")) {
    return trimmed.slice(0, -4);
  }
  return trimmed;
}

export function getConfiguredBackendUrl(): string {
  const raw = String(vscode.workspace.getConfiguration("aiGov").get<string>("backendUrl") ?? "").trim();
  return normalizeBackendUrl(raw);
}

export function getResolvedBackendUrl(): string {
  return cachedResolvedBackendUrl ?? getConfiguredBackendUrl();
}

export async function resolveBackendUrl(logger?: LoggerLike): Promise<string> {
  const configured = getConfiguredBackendUrl();
  if (configured) {
    cachedResolvedBackendUrl = configured;
    return configured;
  }

  if (cachedResolvedBackendUrl) {
    return cachedResolvedBackendUrl;
  }

  const candidates = collectCandidates();
  for (const candidate of candidates) {
    const reachable = await probeCandidate(candidate);
    if (!reachable) {
      continue;
    }

    cachedResolvedBackendUrl = candidate;
    logger?.info(`Auto-detected backend URL: ${candidate}`);
    return candidate;
  }

  return "";
}

export function resetResolvedBackendUrlCacheForTests(): void {
  cachedResolvedBackendUrl = undefined;
}

function collectCandidates(): string[] {
  const fromEnv = normalizeBackendUrl(String(process.env.AIGOV_BACKEND_URL ?? "").trim());
  const all = fromEnv ? [fromEnv, ...DEFAULT_CANDIDATES] : [...DEFAULT_CANDIDATES];
  return [...new Set(all)];
}

async function probeCandidate(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${PROBE_PATH}`, {
      method: "GET",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
