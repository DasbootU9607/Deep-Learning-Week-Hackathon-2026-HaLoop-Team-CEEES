import * as vscode from "vscode";

export const OPEN_CHAT_COMMAND = "aiGov.openChat";

export function registerOpenChatCommand(handler: () => Promise<void>): vscode.Disposable {
  return vscode.commands.registerCommand(OPEN_CHAT_COMMAND, handler);
}
