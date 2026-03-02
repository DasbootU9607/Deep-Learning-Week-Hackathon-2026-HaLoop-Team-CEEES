import * as path from "node:path";
import * as vscode from "vscode";

export type SessionTouchedFile = {
  path: string;
  absolutePath: string;
  existedBefore: boolean;
  preContent?: string;
  preHash?: string;
  postHash?: string;
  applyOrder: number;
};

export type SessionManifest = {
  sessionId: string;
  planId: string;
  workspaceRoot: string;
  createdAt: string;
  touchedFiles: SessionTouchedFile[];
};

export class SessionStore {
  private readonly storePath: string;

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.storePath = path.join(context.globalStorageUri.fsPath, "session-manifest.json");
  }

  public async save(manifest: SessionManifest): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
    const content = JSON.stringify(manifest, null, 2);
    await vscode.workspace.fs.writeFile(vscode.Uri.file(this.storePath), Buffer.from(content, "utf8"));
  }

  public async load(): Promise<SessionManifest | undefined> {
    try {
      const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(this.storePath));
      const parsed = JSON.parse(Buffer.from(raw).toString("utf8")) as SessionManifest;
      if (!parsed?.sessionId || !Array.isArray(parsed?.touchedFiles)) {
        return undefined;
      }
      return parsed;
    } catch {
      return undefined;
    }
  }

  public async clear(): Promise<void> {
    try {
      await vscode.workspace.fs.delete(vscode.Uri.file(this.storePath), { useTrash: false });
    } catch {
      // Nothing to clear.
    }
  }
}
