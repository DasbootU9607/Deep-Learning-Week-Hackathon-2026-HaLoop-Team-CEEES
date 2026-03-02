import path from "node:path";

type MockUri = { fsPath: string };

const files = new Map<string, Uint8Array>();

function normalizeFsPath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, "/");
}

export const Uri = {
  file(fsPath: string): MockUri {
    return { fsPath: normalizeFsPath(fsPath) };
  }
};

export const workspace = {
  fs: {
    async readFile(uri: MockUri): Promise<Uint8Array> {
      const key = normalizeFsPath(uri.fsPath);
      const value = files.get(key);
      if (!value) {
        throw new Error(`ENOENT: ${key}`);
      }
      return new Uint8Array(value);
    },

    async writeFile(uri: MockUri, content: Uint8Array): Promise<void> {
      const key = normalizeFsPath(uri.fsPath);
      files.set(key, new Uint8Array(content));
    },

    async delete(uri: MockUri): Promise<void> {
      const key = normalizeFsPath(uri.fsPath);
      if (!files.has(key)) {
        throw new Error(`ENOENT: ${key}`);
      }
      files.delete(key);
    },

    async createDirectory(_uri: MockUri): Promise<void> {
      // No-op for in-memory file map.
    }
  },

  async saveAll(_includeUntitled?: boolean): Promise<boolean> {
    return true;
  }
};

export function __resetMockFs(): void {
  files.clear();
}

export function __setMockTextFile(filePath: string, content: string): void {
  files.set(normalizeFsPath(filePath), Buffer.from(content, "utf8"));
}

export function __getMockTextFile(filePath: string): string | undefined {
  const value = files.get(normalizeFsPath(filePath));
  if (!value) {
    return undefined;
  }
  return Buffer.from(value).toString("utf8");
}

export function __hasMockFile(filePath: string): boolean {
  return files.has(normalizeFsPath(filePath));
}
