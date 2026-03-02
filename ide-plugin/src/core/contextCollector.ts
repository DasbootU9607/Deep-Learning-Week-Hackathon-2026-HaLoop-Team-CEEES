import * as vscode from "vscode";
import { GitClient } from "../infra/gitClient";
import { GeneratePlanRequest } from "../schemas/contracts";

type ContextResult = GeneratePlanRequest["context"];

export class ContextCollector {
  public constructor(private readonly gitClient: GitClient) {}

  public async collect(): Promise<ContextResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error("Open a workspace folder before running AI tasks.");
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;
    const branch = await this.gitClient.getCurrentBranch(workspaceRoot);

    const activeEditor = vscode.window.activeTextEditor;
    const activeFile = activeEditor?.document.uri.fsPath;
    const selectedText = activeEditor && !activeEditor.selection.isEmpty
      ? activeEditor.document.getText(activeEditor.selection)
      : undefined;

    const openTabCandidates = new Set<string>();
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.scheme === "file") {
        openTabCandidates.add(editor.document.uri.fsPath);
      }
    }
    if (activeFile) {
      openTabCandidates.add(activeFile);
    }

    const openTabs = Array.from(openTabCandidates).slice(0, 8);
    const fileSnippets = (
      await Promise.all(
        openTabs.map(async (filePath) => {
          try {
            const doc = await vscode.workspace.openTextDocument(filePath);
            const range = this.buildSnippetRange(doc, activeEditor?.document.uri.fsPath === filePath ? activeEditor.selection.active.line : 0);
            const text = doc.getText(range);
            return {
              path: filePath,
              content: text,
              startLine: range.start.line + 1,
              endLine: range.end.line + 1
            };
          } catch {
            return undefined;
          }
        })
      )
    ).filter((snippet): snippet is NonNullable<typeof snippet> => Boolean(snippet));

    return {
      workspaceRoot,
      branch,
      activeFile,
      selectedText,
      openTabs,
      fileSnippets
    };
  }

  private buildSnippetRange(document: vscode.TextDocument, centerLine: number): vscode.Range {
    const maxLines = 200;
    const halfWindow = Math.floor(maxLines / 2);
    const startLine = Math.max(0, centerLine - halfWindow);
    const endLine = Math.min(document.lineCount - 1, centerLine + halfWindow);

    const start = new vscode.Position(startLine, 0);
    const endLineText = document.lineAt(endLine).text;
    const end = new vscode.Position(endLine, endLineText.length);

    return new vscode.Range(start, end);
  }
}
