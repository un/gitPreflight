import { existsSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export type InstructionDiscoveryResult = {
  // repo-relative instruction file paths (deduped)
  uniqueInstructionFiles: string[];
  // mapping from changed file -> instruction files that apply (repo-relative)
  perFile: Record<string, string[]>;
};

function isRegularFile(absPath: string): boolean {
  try {
    return statSync(absPath).isFile();
  } catch {
    return false;
  }
}

function isInside(rootAbs: string, childAbs: string): boolean {
  const rel = relative(rootAbs, childAbs);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("../") && !rel.includes("/../"));
}

export function discoverInstructionFiles(
  repoRoot: string,
  changedFiles: string[],
  instructionFileNames: string[]
): InstructionDiscoveryResult {
  const repoAbs = resolve(repoRoot);

  const dirCache = new Map<string, string[]>();
  const unique = new Set<string>();
  const perFile: Record<string, string[]> = {};

  for (const f of changedFiles) {
    const absFile = resolve(join(repoAbs, f));
    let dir = dirname(absFile);
    const applied: string[] = [];

    while (true) {
      if (!isInside(repoAbs, dir)) break;

      const cached = dirCache.get(dir);
      let found: string[];
      if (cached) {
        found = cached;
      } else {
        found = [];
        for (const name of instructionFileNames) {
          const abs = join(dir, name);
          if (existsSync(abs) && isRegularFile(abs)) {
            const rel = relative(repoAbs, abs).replaceAll("\\", "/");
            found.push(rel);
          }
        }
        dirCache.set(dir, found);
      }

      for (const rel of found) {
        unique.add(rel);
        applied.push(rel);
      }

      if (dir === repoAbs) break;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    perFile[f] = Array.from(new Set(applied));
  }

  return {
    uniqueInstructionFiles: [...unique].sort((a, b) => a.localeCompare(b)),
    perFile
  };
}
