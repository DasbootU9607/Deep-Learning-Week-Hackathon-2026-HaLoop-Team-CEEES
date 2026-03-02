import * as vscode from "vscode";

export class Logger {
  private readonly output = vscode.window.createOutputChannel("AI Governance");

  public info(message: string): void {
    this.output.appendLine(`[INFO] ${message}`);
  }

  public warn(message: string): void {
    this.output.appendLine(`[WARN] ${message}`);
  }

  public error(message: string): void {
    this.output.appendLine(`[ERROR] ${message}`);
  }

  public dispose(): void {
    this.output.dispose();
  }
}
