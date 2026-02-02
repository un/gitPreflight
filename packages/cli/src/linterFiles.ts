import type { LintersDetection } from "./lintersDetect";
import type { StagedFile } from "./staged";

export type SelectedLinterFiles = {
  biome: string[];
  eslint: string[];
  prettier: string[];
};

function extnameLower(path: string): string {
  const idx = path.lastIndexOf(".");
  if (idx === -1) return "";
  return path.slice(idx).toLowerCase();
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

export function selectStagedFilesForLinters(staged: StagedFile[], detected: LintersDetection): SelectedLinterFiles {
  const candidates = staged
    .filter((f) => f.changeType !== "deleted")
    .filter((f) => !f.isBinary)
    .map((f) => f.path)
    .filter((p) => !!p);

  const biomeExts = new Set([".js", ".jsx", ".ts", ".tsx", ".json", ".jsonc"]);
  const eslintExts = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"]);
  const prettierExts = new Set([
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".mts",
    ".cts",
    ".json",
    ".jsonc",
    ".md",
    ".mdx",
    ".css",
    ".scss",
    ".less",
    ".yml",
    ".yaml"
  ]);

  const biome = detected.biome.detected
    ? uniq(candidates.filter((p) => biomeExts.has(extnameLower(p))))
    : [];
  const eslint = detected.eslint.detected
    ? uniq(candidates.filter((p) => eslintExts.has(extnameLower(p))))
    : [];
  const prettier = detected.prettier.detected
    ? uniq(candidates.filter((p) => prettierExts.has(extnameLower(p))))
    : [];

  return { biome, eslint, prettier };
}
