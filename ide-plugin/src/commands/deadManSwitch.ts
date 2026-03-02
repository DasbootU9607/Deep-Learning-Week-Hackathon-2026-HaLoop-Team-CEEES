import * as vscode from "vscode";

export const DEAD_MAN_SWITCH_COMMAND = "aiGov.deadManSwitch";

export function registerDeadManSwitchCommand(handler: () => Promise<void>): vscode.Disposable {
  return vscode.commands.registerCommand(DEAD_MAN_SWITCH_COMMAND, handler);
}
