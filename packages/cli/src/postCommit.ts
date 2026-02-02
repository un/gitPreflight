import { getHeadSha } from "./git";
import { clearPendingNextCommit, readPendingNextCommit, readPendingState, writePendingState } from "./state";

export function runPostCommit(repoRoot: string): number {
  const marker = readPendingNextCommit(repoRoot);
  if (!marker) return 0;

  const sha = getHeadSha(repoRoot);
  if (!sha) return 0;

  const state = readPendingState(repoRoot);
  const branch = marker.branch;
  const list = state.branches[branch] ?? [];
  list.push({ sha, createdAtMs: marker.createdAtMs, reason: marker.reason });
  state.branches[branch] = list;

  writePendingState(repoRoot, state);
  clearPendingNextCommit(repoRoot);
  return 0;
}
