import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type DetectedTool = {
  tool: "biome" | "eslint" | "prettier";
  detected: boolean;
  dependencyDetected: boolean;
  configDetected: boolean;
  dependencyName: string;
  configFiles: string[];
};

export type LintersDetection = {
  biome: DetectedTool;
  eslint: DetectedTool;
  prettier: DetectedTool;
};

function readRootPackageJson(repoRoot: string): any {
  const abs = join(repoRoot, "package.json");
  const txt = readFileSync(abs, "utf8");
  return JSON.parse(txt);
}

function hasDependency(pkg: any, name: string): boolean {
  const sections = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;
  for (const s of sections) {
    const deps = pkg?.[s];
    if (deps && typeof deps === "object" && name in deps) return true;
  }
  return false;
}

function detectConfigs(repoRoot: string, candidates: string[]) {
  return candidates.filter((f) => existsSync(join(repoRoot, f)));
}

export function detectLinters(repoRoot: string): LintersDetection {
  let pkg: any = {};
  try {
    pkg = readRootPackageJson(repoRoot);
  } catch {
    pkg = {};
  }

  const biomeConfigFiles = detectConfigs(repoRoot, ["biome.json", "biome.jsonc"]);
  const eslintConfigFiles = detectConfigs(repoRoot, [
    "eslint.config.js",
    "eslint.config.cjs",
    "eslint.config.mjs",
    "eslint.config.ts",
    ".eslintrc",
    ".eslintrc.json",
    ".eslintrc.yaml",
    ".eslintrc.yml",
    ".eslintrc.js",
    ".eslintrc.cjs"
  ]);
  const prettierConfigFiles = detectConfigs(repoRoot, [
    ".prettierrc",
    ".prettierrc.json",
    ".prettierrc.yaml",
    ".prettierrc.yml",
    ".prettierrc.js",
    ".prettierrc.cjs",
    "prettier.config.js",
    "prettier.config.cjs",
    "prettier.config.mjs"
  ]);

  const biomeDep = "@biomejs/biome";
  const eslintDep = "eslint";
  const prettierDep = "prettier";

  const biome = {
    tool: "biome",
    dependencyName: biomeDep,
    dependencyDetected: hasDependency(pkg, biomeDep),
    configDetected: biomeConfigFiles.length > 0,
    configFiles: biomeConfigFiles,
    detected: false
  } as const;
  const eslint = {
    tool: "eslint",
    dependencyName: eslintDep,
    dependencyDetected: hasDependency(pkg, eslintDep),
    configDetected: eslintConfigFiles.length > 0,
    configFiles: eslintConfigFiles,
    detected: false
  } as const;
  const prettier = {
    tool: "prettier",
    dependencyName: prettierDep,
    dependencyDetected: hasDependency(pkg, prettierDep),
    configDetected: prettierConfigFiles.length > 0,
    configFiles: prettierConfigFiles,
    detected: false
  } as const;

  return {
    biome: { ...biome, detected: biome.dependencyDetected || biome.configDetected },
    eslint: { ...eslint, detected: eslint.dependencyDetected || eslint.configDetected },
    prettier: { ...prettier, detected: prettier.dependencyDetected || prettier.configDetected }
  };
}
