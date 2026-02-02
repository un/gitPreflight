import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type PackageJson = Record<string, any>;

export function readPackageJson(repoRoot: string): PackageJson {
  const abs = join(repoRoot, "package.json");
  const txt = readFileSync(abs, "utf8");
  const parsed = JSON.parse(txt);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("package.json is not an object");
  }
  return parsed as PackageJson;
}

export function writePackageJson(repoRoot: string, pkg: PackageJson) {
  const abs = join(repoRoot, "package.json");
  writeFileSync(abs, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}
