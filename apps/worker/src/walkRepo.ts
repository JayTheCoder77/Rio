import fs from "node:fs/promises";
import path from "node:path";

// Mirrors packages/rio-core/rio_core/chunking.py's walk_repo/DIRS_TO_IGNORE/
// _is_ignored_filename — kept in sync by hand since this now runs on the
// worker (which has the clone) rather than ai-engine (which doesn't).
const DIRS_TO_IGNORE = new Set([
  ".git", "node_modules", "dist", "build", ".venv", "__pycache__", ".next", "target", ".turbo",
]);

const ENV_FILENAME_ALLOWLIST = new Set([".env.example"]);

function isIgnoredFilename(filename: string): boolean {
  if (ENV_FILENAME_ALLOWLIST.has(filename)) return false;
  return filename.startsWith(".env");
}

const MAX_FILE_BYTES = 500_000;

export async function walkRepo(repoPath: string): Promise<{ path: string; content: string }[]> {
  const result: { path: string; content: string }[] = [];

  async function visit(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (DIRS_TO_IGNORE.has(entry.name)) continue;
        await visit(path.join(dir, entry.name));
        continue;
      }
      if (!entry.isFile() || isIgnoredFilename(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      const { size } = await fs.stat(fullPath);
      if (size >= MAX_FILE_BYTES) continue;

      try {
        const content = await fs.readFile(fullPath, "utf-8");
        result.push({ path: path.relative(repoPath, fullPath), content });
      } catch {
        // Matches walk_repo's behavior: skip files that aren't valid UTF-8
        // (binaries, etc.) rather than failing the whole index job.
      }
    }
  }

  await visit(repoPath);
  return result;
}
