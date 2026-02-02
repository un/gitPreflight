import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun" | "unknown";

function readRootPackageJson(repoRoot: string): any {
  const abs = join(repoRoot, "package.json");
  const txt = readFileSync(abs, "utf8");
  return JSON.parse(txt);
}

export function detectPackageManager(repoRoot: string): PackageManager {
  try {
    const pkg = readRootPackageJson(repoRoot);
    const pm = typeof pkg?.packageManager === "string" ? pkg.packageManager : "";
    const name = pm.split("@")[0];
    if (name === "pnpm" || name === "npm" || name === "yarn" || name === "bun") return name;
  } catch {
    // ignore
  }

  if (existsSync(join(repoRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(repoRoot, "package-lock.json"))) return "npm";
  if (existsSync(join(repoRoot, "yarn.lock"))) return "yarn";
  if (existsSync(join(repoRoot, "bun.lockb")) || existsSync(join(repoRoot, "bun.lock"))) return "bun";

  return "unknown";
}

export function makeExecCommand(pm: PackageManager, bin: string, args: string[]) {
  if (pm === "pnpm") return { command: "pnpm", args: ["exec", bin, ...args] };
  if (pm === "npm") return { command: "npm", args: ["exec", "--", bin, ...args] };
  if (pm === "yarn") return { command: "yarn", args: ["-s", "run", bin, ...args] };
  if (pm === "bun") return { command: "bunx", args: [bin, ...args] };
  return { command: bin, args };
}
