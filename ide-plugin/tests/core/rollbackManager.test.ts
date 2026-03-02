import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscodeMockModule from "vscode";
import { RollbackManager } from "../../src/core/rollbackManager";
import { SessionManifest } from "../../src/core/sessionStore";
import { GitClient } from "../../src/infra/gitClient";

type VscodeMockHelpers = {
  __resetMockFs: () => void;
  __setMockTextFile: (filePath: string, content: string) => void;
  __getMockTextFile: (filePath: string) => string | undefined;
  __hasMockFile: (filePath: string) => boolean;
};

const vscodeHelpers = vscodeMockModule as unknown as VscodeMockHelpers;

const WORKSPACE_ROOT = "/workspace";

function hash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function createManifest(overrides: Partial<SessionManifest>): SessionManifest {
  return {
    sessionId: "session-1",
    planId: "plan-1",
    workspaceRoot: WORKSPACE_ROOT,
    createdAt: new Date().toISOString(),
    touchedFiles: [],
    ...overrides
  };
}

describe("RollbackManager", () => {
  beforeEach(() => {
    vscodeHelpers.__resetMockFs();
  });

  it("restores previous content for touched uncommitted files", async () => {
    const filePath = `${WORKSPACE_ROOT}/src/feature.ts`;
    vscodeHelpers.__setMockTextFile(filePath, "new AI content\n");

    const gitClient = {
      hasUncommittedChanges: vi.fn(async () => true)
    } as unknown as GitClient;

    const manager = new RollbackManager(gitClient);
    const manifest = createManifest({
      touchedFiles: [
        {
          path: "src/feature.ts",
          absolutePath: filePath,
          existedBefore: true,
          preContent: "old content\n",
          preHash: hash("old content\n"),
          postHash: hash("new AI content\n"),
          applyOrder: 0
        }
      ]
    });

    const report = await manager.rollback(manifest);

    expect(report.restored).toEqual(["src/feature.ts"]);
    expect(report.skipped).toEqual([]);
    expect(report.conflicts).toEqual([]);
    expect(vscodeHelpers.__getMockTextFile(filePath)).toBe("old content\n");
  });

  it("skips files without uncommitted changes", async () => {
    const filePath = `${WORKSPACE_ROOT}/src/no-change.ts`;
    vscodeHelpers.__setMockTextFile(filePath, "ai output\n");

    const gitClient = {
      hasUncommittedChanges: vi.fn(async () => false)
    } as unknown as GitClient;

    const manager = new RollbackManager(gitClient);
    const manifest = createManifest({
      touchedFiles: [
        {
          path: "src/no-change.ts",
          absolutePath: filePath,
          existedBefore: true,
          preContent: "old\n",
          preHash: hash("old\n"),
          postHash: hash("ai output\n"),
          applyOrder: 0
        }
      ]
    });

    const report = await manager.rollback(manifest);

    expect(report.restored).toEqual([]);
    expect(report.skipped).toHaveLength(1);
    expect(report.skipped[0]?.path).toBe("src/no-change.ts");
    expect(vscodeHelpers.__getMockTextFile(filePath)).toBe("ai output\n");
  });

  it("reports conflict when current content hash differs from session post-hash", async () => {
    const filePath = `${WORKSPACE_ROOT}/src/conflict.ts`;
    vscodeHelpers.__setMockTextFile(filePath, "manually changed\n");

    const gitClient = {
      hasUncommittedChanges: vi.fn(async () => true)
    } as unknown as GitClient;

    const manager = new RollbackManager(gitClient);
    const manifest = createManifest({
      touchedFiles: [
        {
          path: "src/conflict.ts",
          absolutePath: filePath,
          existedBefore: true,
          preContent: "old value\n",
          preHash: hash("old value\n"),
          postHash: hash("ai version\n"),
          applyOrder: 0
        }
      ]
    });

    const report = await manager.rollback(manifest);

    expect(report.restored).toEqual([]);
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0]?.path).toBe("src/conflict.ts");
    expect(vscodeHelpers.__getMockTextFile(filePath)).toBe("manually changed\n");
  });

  it("deletes files that did not exist before the AI session", async () => {
    const filePath = `${WORKSPACE_ROOT}/new-file.ts`;
    vscodeHelpers.__setMockTextFile(filePath, "generated\n");

    const gitClient = {
      hasUncommittedChanges: vi.fn(async () => true)
    } as unknown as GitClient;

    const manager = new RollbackManager(gitClient);
    const manifest = createManifest({
      touchedFiles: [
        {
          path: "new-file.ts",
          absolutePath: filePath,
          existedBefore: false,
          preContent: undefined,
          preHash: undefined,
          postHash: hash("generated\n"),
          applyOrder: 0
        }
      ]
    });

    const report = await manager.rollback(manifest);

    expect(report.restored).toEqual(["new-file.ts"]);
    expect(vscodeHelpers.__hasMockFile(filePath)).toBe(false);
  });
});
