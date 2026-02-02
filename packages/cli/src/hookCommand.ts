import { detectPackageManager, type PackageManager } from "./packageManager";

export function makeShipstampReviewHookLine(pm: PackageManager): string {
  if (pm === "pnpm") return "pnpm exec shipstamp review --staged";
  if (pm === "npm") return "npm exec -- shipstamp review --staged";
  if (pm === "yarn") return "yarn -s shipstamp review --staged";
  if (pm === "bun") return "bunx shipstamp review --staged";

  return "npx --no-install shipstamp review --staged";
}

export function makeShipstampPostCommitHookLine(pm: PackageManager): string {
  if (pm === "pnpm") return "pnpm exec shipstamp internal post-commit";
  if (pm === "npm") return "npm exec -- shipstamp internal post-commit";
  if (pm === "yarn") return "yarn -s shipstamp internal post-commit";
  if (pm === "bun") return "bunx shipstamp internal post-commit";

  return "npx --no-install shipstamp internal post-commit";
}

export function getShipstampPostCommitHookLine(repoRoot: string): string {
  const pm = detectPackageManager(repoRoot);
  return makeShipstampPostCommitHookLine(pm);
}

export function getShipstampReviewHookLine(repoRoot: string): string {
  const pm = detectPackageManager(repoRoot);
  return makeShipstampReviewHookLine(pm);
}
