import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class GitClient {
  public async getCurrentBranch(workspaceRoot: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: workspaceRoot
      });
      return stdout.trim() || "unknown";
    } catch {
      return "unknown";
    }
  }

  public async hasUncommittedChanges(workspaceRoot: string, absolutePath: string): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync("git", ["status", "--porcelain", "--", absolutePath], {
        cwd: workspaceRoot
      });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }
}
