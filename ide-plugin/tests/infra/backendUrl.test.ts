import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetMockConfiguration, __setMockConfigurationValue } from "../mocks/vscode";
import {
  getConfiguredBackendUrl,
  normalizeBackendUrl,
  resetResolvedBackendUrlCacheForTests,
  resolveBackendUrl,
} from "../../src/infra/backendUrl";

describe("backendUrl", () => {
  beforeEach(() => {
    __resetMockConfiguration();
    resetResolvedBackendUrlCacheForTests();
    vi.restoreAllMocks();
  });

  it("normalizes trailing slashes and /api suffixes", () => {
    expect(normalizeBackendUrl("http://localhost:3000/api/")).toBe("http://localhost:3000");
    expect(normalizeBackendUrl("http://127.0.0.1:3000///")).toBe("http://127.0.0.1:3000");
  });

  it("uses configured backend URL directly", async () => {
    __setMockConfigurationValue("aiGov.backendUrl", "http://localhost:3000/api");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const resolved = await resolveBackendUrl();

    expect(getConfiguredBackendUrl()).toBe("http://localhost:3000");
    expect(resolved).toBe("http://localhost:3000");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("auto-detects a reachable local backend when config is blank", async () => {
    __setMockConfigurationValue("aiGov.backendUrl", "");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      return { ok: url === "http://localhost:3000/api/incident" } as Response;
    });

    const resolved = await resolveBackendUrl();

    expect(resolved).toBe("http://localhost:3000");
  });
});
