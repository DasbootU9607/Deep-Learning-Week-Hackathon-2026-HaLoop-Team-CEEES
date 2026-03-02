import * as vscode from "vscode";

export const RUN_TASK_COMMAND = "aiGov.runTask";

export function registerRunTaskCommand(handler: (prompt?: string) => Promise<void>): vscode.Disposable {
  return vscode.commands.registerCommand(RUN_TASK_COMMAND, handler);
}
