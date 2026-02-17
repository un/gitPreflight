import { detectPackageManager, type PackageManager } from "./packageManager";

function withHookUi(cmd: string): string {
  // Always force stable Markdown output inside hooks.
  return `GITPREFLIGHT_HOOK=1 GITPREFLIGHT_UI=plain ${cmd}`;
}

export function makeGitPreflightReviewHookLine(pm: PackageManager): string {
  if (pm === "pnpm") return withHookUi("pnpm exec gitpreflight review --staged --local-agent");
  if (pm === "npm") return withHookUi("npm exec -- gitpreflight review --staged --local-agent");
  if (pm === "yarn") return withHookUi("yarn -s gitpreflight review --staged --local-agent");
  if (pm === "bun") return withHookUi("bunx gitpreflight review --staged --local-agent");

  return withHookUi("npx --no-install gitpreflight review --staged --local-agent");
}

export function makeGitPreflightPushReviewHookLine(pm: PackageManager): string {
  // Pass through pre-push hook args (remote name + remote url).
  if (pm === "pnpm") return withHookUi("pnpm exec gitpreflight review --push --local-agent \"$@\"");
  if (pm === "npm") return withHookUi("npm exec -- gitpreflight review --push --local-agent \"$@\"");
  if (pm === "yarn") return withHookUi("yarn -s gitpreflight review --push --local-agent \"$@\"");
  if (pm === "bun") return withHookUi("bunx gitpreflight review --push --local-agent \"$@\"");

  return withHookUi("npx --no-install gitpreflight review --push --local-agent \"$@\"");
}

export function makeGitPreflightPostCommitHookLine(pm: PackageManager): string {
  if (pm === "pnpm") return withHookUi("pnpm exec gitpreflight internal post-commit");
  if (pm === "npm") return withHookUi("npm exec -- gitpreflight internal post-commit");
  if (pm === "yarn") return withHookUi("yarn -s gitpreflight internal post-commit");
  if (pm === "bun") return withHookUi("bunx gitpreflight internal post-commit");

  return withHookUi("npx --no-install gitpreflight internal post-commit");
}

export function getGitPreflightPostCommitHookLine(repoRoot: string): string {
  const pm = detectPackageManager(repoRoot);
  return makeGitPreflightPostCommitHookLine(pm);
}

export function getGitPreflightReviewHookLine(repoRoot: string): string {
  const pm = detectPackageManager(repoRoot);
  return makeGitPreflightReviewHookLine(pm);
}

export function getGitPreflightPushReviewHookLine(repoRoot: string): string {
  const pm = detectPackageManager(repoRoot);
  return makeGitPreflightPushReviewHookLine(pm);
}
