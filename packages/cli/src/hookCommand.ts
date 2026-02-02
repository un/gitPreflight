import { detectPackageManager, type PackageManager } from "./packageManager";

export function makeShipstampReviewHookLine(pm: PackageManager): string {
  if (pm === "pnpm") return "pnpm exec shipstamp review --staged";
  if (pm === "npm") return "npm exec -- shipstamp review --staged";
  if (pm === "yarn") return "yarn -s shipstamp review --staged";
  if (pm === "bun") return "bunx shipstamp review --staged";

  return "npx --no-install shipstamp review --staged";
}

export function getShipstampReviewHookLine(repoRoot: string): string {
  const pm = detectPackageManager(repoRoot);
  return makeShipstampReviewHookLine(pm);
}
