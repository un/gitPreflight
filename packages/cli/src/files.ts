import { readFileSync } from "node:fs";
import { join } from "node:path";

export function readTextFile(repoRoot: string, repoRelativePath: string): string {
  return readFileSync(join(repoRoot, repoRelativePath), "utf8");
}
