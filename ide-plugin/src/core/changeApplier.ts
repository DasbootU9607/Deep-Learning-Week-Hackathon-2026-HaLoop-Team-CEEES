import * as crypto from "node:crypto";
import * as path from "node:path";
import * as vscode from "vscode";
import { FileChange } from "../schemas/contracts";
import { SessionManifest, SessionTouchedFile } from "./sessionStore";

export class ChangeApplier {
  public async applyChanges(params: {
    sessionId: string;
    planId: string;
    workspaceRoot: string;
    changes: FileChange[];
  }): Promise<SessionManifest> {
    const touchedFiles: SessionTouchedFile[] = [];

    for (let index = 0; index < params.changes.length; index += 1) {
      const change = params.changes[index];
      const absolutePath = path.resolve(params.workspaceRoot, change.path);
      const uri = vscode.Uri.file(absolutePath);

      const preExisting = await this.readFileIfExists(uri);
      const existedBefore = preExisting !== undefined;
      const preHash = preExisting !== undefined ? hashContent(preExisting) : undefined;

      try {
        await this.applySingleChange(change, uri, preExisting);
      } catch (error) {
        throw new Error(`Failed applying ${change.path}: ${toErrorMessage(error)}`);
      }

      const postExisting = await this.readFileIfExists(uri);
      const postHash = postExisting !== undefined ? hashContent(postExisting) : undefined;

      touchedFiles.push({
        path: normalizePath(path.relative(params.workspaceRoot, absolutePath)),
        absolutePath,
        existedBefore,
        preContent: preExisting,
        preHash,
        postHash,
        applyOrder: index
      });
    }

    await vscode.workspace.saveAll(false);

    return {
      sessionId: params.sessionId,
      planId: params.planId,
      workspaceRoot: params.workspaceRoot,
      createdAt: new Date().toISOString(),
      touchedFiles
    };
  }

  private async applySingleChange(change: FileChange, uri: vscode.Uri, preContent: string | undefined): Promise<void> {
    if (change.action === "delete") {
      const edit = new vscode.WorkspaceEdit();
      edit.deleteFile(uri, { ignoreIfNotExists: false });
      const ok = await vscode.workspace.applyEdit(edit);
      if (!ok) {
        throw new Error("workspace.applyEdit returned false on delete");
      }
      return;
    }

    const newContent = change.newContent ?? "";
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));

    if (preContent === undefined) {
      const edit = new vscode.WorkspaceEdit();
      edit.createFile(uri, { ignoreIfExists: true, overwrite: true });
      edit.insert(uri, new vscode.Position(0, 0), newContent);
      const ok = await vscode.workspace.applyEdit(edit);
      if (!ok) {
        throw new Error("workspace.applyEdit returned false on create");
      }
      return;
    }

    const document = await vscode.workspace.openTextDocument(uri);
    const lastPosition = document.positionAt(document.getText().length);
    const fullRange = new vscode.Range(new vscode.Position(0, 0), lastPosition);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, fullRange, newContent);
    const ok = await vscode.workspace.applyEdit(edit);
    if (!ok) {
      throw new Error("workspace.applyEdit returned false on update");
    }
  }

  private async readFileIfExists(uri: vscode.Uri): Promise<string | undefined> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(bytes).toString("utf8");
    } catch {
      return undefined;
    }
  }
}

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
