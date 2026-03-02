import * as crypto from "node:crypto";
import * as path from "node:path";
import * as vscode from "vscode";
import { GitClient } from "../infra/gitClient";
import { SessionManifest } from "./sessionStore";

export type RollbackReport = {
  restored: string[];
  skipped: Array<{ path: string; reason: string }>;
  conflicts: Array<{ path: string; reason: string }>;
};

export class RollbackManager {
  public constructor(private readonly gitClient: GitClient) {}

  public async rollback(manifest: SessionManifest): Promise<RollbackReport> {
    const report: RollbackReport = {
      restored: [],
      skipped: [],
      conflicts: []
    };

    const ordered = [...manifest.touchedFiles].sort((a, b) => b.applyOrder - a.applyOrder);

    for (const file of ordered) {
      const uri = vscode.Uri.file(file.absolutePath);
      const relativePath = normalizePath(path.relative(manifest.workspaceRoot, file.absolutePath));

      const hasUncommitted = await this.gitClient.hasUncommittedChanges(manifest.workspaceRoot, file.absolutePath);
      if (!hasUncommitted) {
        report.skipped.push({ path: relativePath, reason: "No uncommitted changes." });
        continue;
      }

      const currentContent = await readFileIfExists(uri);
      const currentHash = currentContent !== undefined ? hashContent(currentContent) : undefined;
      if (file.postHash && currentHash && currentHash !== file.postHash) {
        report.conflicts.push({ path: relativePath, reason: "File changed since AI apply." });
        continue;
      }

      try {
        if (file.existedBefore) {
          await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));
          await vscode.workspace.fs.writeFile(uri, Buffer.from(file.preContent ?? "", "utf8"));
        } else {
          await vscode.workspace.fs.delete(uri, { useTrash: false });
        }
        report.restored.push(relativePath);
      } catch (error) {
        report.conflicts.push({
          path: relativePath,
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }

    await vscode.workspace.saveAll(false);
    return report;
  }
}

async function readFileIfExists(uri: vscode.Uri): Promise<string | undefined> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString("utf8");
  } catch {
    return undefined;
  }
}

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
