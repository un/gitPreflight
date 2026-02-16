import { formatReviewResultMarkdown, GITPREFLIGHT_CORE_VERSION } from "@gitpreflight/core";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  getBranchName,
  getDefaultBranchFromOrigin,
  getHeadSha,
  getOriginUrl,
  getRepoRoot,
  normalizeOriginUrl
} from "./git";
import { loadGitPreflightRepoConfig } from "./repoConfig";
import { collectStagedFiles } from "./staged";
import { collectStagedPatch } from "./stagedPatch";
import { discoverInstructionFiles } from "./instructions";
import { hashFilesSha256 } from "./hash";
import {
  clearSkipNext,
  readPendingState,
  readSkipNext,
  writePendingNextCommit,
  writePendingState,
  writeSkipNext
} from "./state";
import { repoHasExistingPrecommitLinting } from "./precommitDetection";
import { getGitPreflightEnv } from "./env";
import { detectLinters } from "./lintersDetect";
import { selectStagedFilesForLinters } from "./linterFiles";
import { detectPackageManager } from "./packageManager";
import { runLintersInCheckMode } from "./runLinters";
import { initRepo, type InitHookMode } from "./init";
import { isOfflineOrTimeoutError } from "./errors";
import { runPostCommit } from "./postCommit";
import { deviceAuthLogin } from "./deviceAuth";
import { loadToken } from "./token";
import { readTextFile } from "./files";
import { loadRepoEnv } from "./dotenvFile";
import { GitPreflightApiClient, GitPreflightApiError } from "./apiClient";
import { emitMarkdown, resolveGitPreflightUi } from "./ui";
import { GITPREFLIGHT_CLI_VERSION } from "./version";
import { collectPushReviewInputFromHook, parsePrePushStdin } from "./pushReview";
import {
  getInstallStatus,
  installGlobalScope,
  installLocalScope,
  installRepoScope,
  uninstallGlobalScope,
  uninstallLocalScope,
  type InstallScope
} from "./scopedInstall";
import { runInstallWizardTui } from "./installTui";
import { markOnboardingNoticeShown, onboardingNoticeText, shouldShowOnboardingNotice } from "./onboarding";
import { resolvePolicy } from "./policy";
import { getDefaultLocalAgentCommand, getLocalAgentConfig, saveLocalAgentConfig, type LocalAgentProvider } from "./cliConfig";
import { probeLocalAgentCommand } from "./localAgent";
import { buildLocalAgentReviewPrompt } from "./localAgentPrompt";
import { getOutdatedNoticeText, resolveCliUpdateStatus } from "./updateCheck";
import { interactiveSelect } from "./interactiveSelect";

function printHelp() {
  process.stdout.write(
    [
      `gitpreflight ${GITPREFLIGHT_CLI_VERSION} — core ${GITPREFLIGHT_CORE_VERSION}`,
      "",
      "Usage:",
      "  gitpreflight <command> [options]",
      "",
      "Commands:",
      "  review --staged        Review staged changes",
      "  review --push          Review commits being pushed",
      "  version                Show current/latest CLI version",
      "  setup [options]        Set up GitPreflight + local-agent",
      "  uninstall --scope ...  Remove GitPreflight for a scope",
      "  status                 Show setup status + effective scope",
      "  init [--hook ...]      Install git hooks + config (v0: stub)",
      "  auth login             Authenticate the CLI (v0: stub)",
      "  skip-next --reason ... Bypass next hook run (v0: stub)",
      "",
      "Global options:",
      "  -h, --help             Show help",
      "  -v, --version          Show version",
      ""
    ].join("\n")
  );
}

function printVersion() {
  process.stdout.write(`${GITPREFLIGHT_CLI_VERSION}\n`);
}

async function cmdVersion(opts: { inCi: boolean; inHook: boolean }) {
  printVersion();

  const updateStatus = await resolveCliUpdateStatus({
    currentVersion: GITPREFLIGHT_CLI_VERSION,
    inCi: opts.inCi,
    inHook: opts.inHook
  });

  if (updateStatus.latestVersion) {
    process.stdout.write(`latest: v${updateStatus.latestVersion}\n`);
  }

  const updateNotice = getOutdatedNoticeText(updateStatus);
  if (updateNotice) {
    process.stderr.write(`${updateNotice}\n`);
  }

  return 0;
}

function unknownCommand(cmd: string | undefined) {
  if (!cmd) {
    printHelp();
    return 0;
  }

  process.stderr.write(`Unknown command: ${cmd}\n\n`);
  printHelp();
  return 2;
}

async function cmdReview(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    options: {
      staged: { type: "boolean" },
      push: { type: "boolean" },
      "local-agent": { type: "boolean" },
      tui: { type: "boolean" },
      plain: { type: "boolean" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true
  });

  if (parsed.values.help) {
    process.stdout.write("Usage: gitpreflight review (--staged|--push) [--tui|--plain]\n");
    return 0;
  }

  const wantsStaged = Boolean((parsed.values as any).staged);
  const wantsPush = Boolean((parsed.values as any).push);

  if ((wantsStaged && wantsPush) || (!wantsStaged && !wantsPush)) {
    process.stderr.write("Missing required flag: --staged or --push\n");
    return 2;
  }

  const mode: "staged" | "push" = wantsPush ? "push" : "staged";

  // Ensure we're inside a git repo early.
  let repoRoot: string;
  try {
    repoRoot = getRepoRoot();
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }

  const headSha = getHeadSha(repoRoot);
  if (mode === "push" && !headSha) {
    process.stderr.write("Cannot review push changes in an empty repo (no commits).\n");
    return 2;
  }

  const pushArgs = parsed.positionals;
  const pushRemoteName = mode === "push" ? (pushArgs[0] ?? "origin") : "origin";

  const pushStdin = (() => {
    if (mode !== "push") return "";
    if (process.stdin.isTTY) return "";
    const probablyInHook = process.env.GITPREFLIGHT_HOOK === "1" || Boolean(process.env.GIT_DIR) || pushArgs.length > 0;
    if (!probablyInHook) return "";
    try {
      return readFileSync(0, "utf8");
    } catch {
      return "";
    }
  })();

  const branchFromPush = (() => {
    if (mode !== "push") return null;
    const updates = parsePrePushStdin(pushStdin)
      .map((u) => u.localRef)
      .filter((r) => r.startsWith("refs/heads/"))
      .map((r) => r.replace(/^refs\/heads\//, ""));
    return updates.length === 1 ? updates[0]! : null;
  })();

  const branch = branchFromPush ?? getBranchName() ?? "(detached)";

  const isBunRuntime = typeof (globalThis as any).Bun !== "undefined";

  const env = process.env;
  const inCi = env.CI === "1" || env.CI === "true" || env.GITHUB_ACTIONS === "1" || env.GITHUB_ACTIONS === "true";
  const inHook = env.GITPREFLIGHT_HOOK === "1" || Boolean(env.GIT_DIR);
  const stdoutIsTty = Boolean(process.stdout.isTTY);
  const ui = resolveGitPreflightUi({
    inCi,
    inHook,
    stdoutIsTty,
    isBunRuntime,
    argv: { plain: Boolean((parsed.values as any).plain), tui: Boolean((parsed.values as any).tui) },
    env
  });

  const emit = async (md: string) => {
    await emitMarkdown({ ui, markdown: md });
  };

  const updateStatus = await resolveCliUpdateStatus({
    currentVersion: GITPREFLIGHT_CLI_VERSION,
    inCi,
    inHook
  });

  const appendUpdateNoticeFinding = (findings: Array<import("@gitpreflight/core").Finding>) => {
    const notice = getOutdatedNoticeText(updateStatus);
    if (!notice) return findings;
    return findings.concat({
      path: "gitpreflight",
      severity: "note",
      title: "Update available",
      message: notice
    });
  };

  const emitReviewResult = async (status: "PASS" | "FAIL" | "UNCHECKED", findings: Array<import("@gitpreflight/core").Finding>) => {
    const md = formatReviewResultMarkdown({ status, findings: appendUpdateNoticeFinding(findings) });
    await emit(md);
  };

  const policyResolution = resolvePolicy(repoRoot);
  const effectivePolicy = policyResolution.effective;

  if (inHook && effectivePolicy.policy === "disabled") {
    await emitReviewResult("PASS", [
      {
        path: "package.json",
        severity: "note",
        title: "GitPreflight disabled by policy",
        message: `Policy is disabled (source: ${effectivePolicy.source}). Skipping review.`
      }
    ]);
    return 0;
  }

  const policyWarningFinding =
    inHook &&
    effectivePolicy.source === "repo" &&
    effectivePolicy.policy === "required" &&
    (policyResolution.ignored.local || policyResolution.ignored.global)
      ? {
          path: "package.json",
          severity: "note" as const,
          title: "Repo policy override active",
          message:
            "Repo policy is `required`, so local/global policy overrides are ignored for this repository. " +
            "Update `package.json#gitpreflight.policy` if you want to change enforcement for the whole repo."
        }
      : null;

  const skip = readSkipNext(repoRoot);
  if (skip) {
    clearSkipNext(repoRoot);
    await emitReviewResult("PASS", [
      {
        path: "package.json",
        severity: "note",
        title: "GitPreflight skipped",
        message: `GitPreflight skipped this run (skip-next). Reason: ${skip.reason}`
      }
    ]);
    return 0;
  }

  const pending = readPendingState(repoRoot);
  const pendingOnBranch = pending.branches[branch] ?? [];
  if (pendingOnBranch.length > 0) {
    const list = pendingOnBranch.map((p) => `- ${p.sha}${p.reason ? ` (${p.reason})` : ""}`).join("\n");
    await emitReviewResult("FAIL", [
      {
        path: "package.json",
        severity: "minor",
        title: "Unchecked backlog on this branch",
        message:
          (mode === "push"
            ? "GitPreflight previously allowed one or more pushes without a completed review (offline/timeout).\n\n"
            : "GitPreflight previously allowed one or more commits without a completed review (offline/timeout).\n\n") +
          "Unchecked commits:\n" +
          `${list}\n\n` +
          "To proceed, either:\n" +
          "- Run `gitpreflight skip-next --reason \"...\"` to bypass once, or\n" +
          (mode === "push" ? "- Use `git push --no-verify` to bypass hooks\n" : "- Use `git commit --no-verify` to bypass hooks\n")
      }
    ]);
    return 1;
  }

  try {
    const repoConfig = loadGitPreflightRepoConfig(repoRoot);
    const useLocalAgent = true;

    const reviewInput =
      mode === "staged"
        ? {
            patch: collectStagedPatch(repoRoot),
            files: collectStagedFiles(repoRoot),
            commitShas: [] as string[]
          }
        : collectPushReviewInputFromHook(repoRoot, {
            remoteName: pushRemoteName,
            stdin: pushStdin,
            headSha: headSha!
          });

    const reviewFiles = reviewInput.files;
    const reviewPatch = reviewInput.patch;
    const pushCommitShas = reviewInput.commitShas;

    const changedPaths = reviewFiles
      .filter((f) => f.path && f.changeType !== "deleted")
      .map((f) => f.path);

    let instructionFilenames = repoConfig.instructionFiles;
    let discovered = discoverInstructionFiles(repoRoot, changedPaths, instructionFilenames);
    void hashFilesSha256(repoRoot, discovered.uniqueInstructionFiles);

    const detectedLinters = detectLinters(repoRoot);
    const selected = selectStagedFilesForLinters(reviewFiles, detectedLinters);

    const pm = detectPackageManager(repoRoot);

    let findings: Array<import("@gitpreflight/core").Finding> = policyWarningFinding ? [policyWarningFinding] : [];

    const repoEnv = loadRepoEnv(repoRoot);
    const mergedEnv = { ...process.env, ...repoEnv } as NodeJS.ProcessEnv;

    let apiBaseUrl: string | null = null;
    if (!useLocalAgent) {
      try {
        apiBaseUrl = getGitPreflightEnv(mergedEnv).GITPREFLIGHT_API_BASE_URL;
      } catch (err) {
        findings.push({
          path: "package.json",
          severity: "minor",
          title: "Missing required environment",
          message:
            "GitPreflight needs GITPREFLIGHT_API_BASE_URL to contact the GitPreflight API (separate app/domain).\n\n" +
            "Set it in your environment, e.g.:\n\n" +
            "`export GITPREFLIGHT_API_BASE_URL=https://api.gitpreflight.example`\n\n" +
            `Error: ${(err as Error).message}`
        });
      }
    }

    if (apiBaseUrl) {
      let token: string | null = null;
      try {
        token = loadToken();
      } catch {
        findings.push({
          path: "package.json",
          severity: "minor",
          title: "Not authenticated",
              message: "Run `gitpreflight auth login` to authenticate the CLI."
        });
      }

      if (token) {
        // Best-effort: pull org-managed instruction filenames.
        try {
          const apiClient = new GitPreflightApiClient({ baseUrl: apiBaseUrl, token, timeoutMs: repoConfig.timeoutMs });
          const settings = await apiClient.getJson<{ instructionFilenames?: string[] }>("/api/v1/orgs/settings");
          if (Array.isArray(settings.instructionFilenames) && settings.instructionFilenames.length > 0) {
            instructionFilenames = settings.instructionFilenames;
            discovered = discoverInstructionFiles(repoRoot, changedPaths, instructionFilenames);
          }
        } catch {
          // ignore
        }

        const originUrl = getOriginUrl(repoRoot);
        if (!originUrl) {
          findings.push({
            path: ".git/config",
            severity: "minor",
            title: "Missing git remote origin",
            message:
              "GitPreflight identifies repositories by `remote.origin.url`. Configure a remote named `origin` (e.g. `git remote add origin ...`) and try again."
          });
        }

        // Best-effort instruction sync (never blocks review).
        try {
          const hashed = hashFilesSha256(repoRoot, discovered.uniqueInstructionFiles);
          const files = hashed.hashed.map((h) => ({ path: h.path, sha256: h.sha256 }));

          const checkRes = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/v1/instructions/check`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ files })
          });

          if (checkRes.ok) {
            const payload = (await checkRes.json()) as { missing: Array<{ path: string; sha256: string }> };
            const missingFiles = payload.missing ?? [];
            if (missingFiles.length > 0) {
              const uploadFiles = missingFiles.map((m) => ({
                path: m.path,
                sha256: m.sha256,
                content: readTextFile(repoRoot, m.path)
              }));

              await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/v1/instructions/upload`, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ files: uploadFiles })
              });
            }
          }
        } catch {
          // ignore
        }
      }
    }

    if (repoConfig.linters.enabled) {
      const hasPrecommitLinting = repoHasExistingPrecommitLinting(repoRoot);
      if (!repoConfig.linters.skipIfRepoAlreadyHasPrecommit || !hasPrecommitLinting) {
        findings = findings.concat(
          runLintersInCheckMode({
            repoRoot,
            detected: detectedLinters,
            selectedFiles: selected,
            packageManager: pm,
            timeoutMs: repoConfig.timeoutMs
          })
        );
      }
    }

    // Local blockers (env/auth/linters) should still block before the network call.
    if (findings.some((f) => f.severity === "minor" || f.severity === "major")) {
      await emitReviewResult("FAIL", findings);
      return 1;
    }

    if (useLocalAgent) {
      const localAgent = getLocalAgentConfig();
      const cmd = localAgent?.command;
      if (!cmd || cmd.trim().length === 0) {
        findings.push({
          path: "~/.config/gitpreflight/config.json",
          severity: "minor",
          title: "Missing local agent command",
          message:
            "No local-agent command is configured. Run `gitpreflight setup` to configure your local agent command."
        });
      }

      if (findings.some((f) => f.severity === "minor" || f.severity === "major")) {
        await emitReviewResult("FAIL", findings);
        return 1;
      }

      const instructionFiles = hashFilesSha256(repoRoot, discovered.uniqueInstructionFiles).hashed.map((h) => ({
        path: h.path,
        content: readTextFile(repoRoot, h.path)
      }));

      const prompt = buildLocalAgentReviewPrompt({
        mode,
        reviewPatch,
        instructionFiles
      });

      const command = cmd as string;
      const { runLocalAgentMarkdownReview } = await import("./localAgent");
      const local = runLocalAgentMarkdownReview({
        command,
        cwd: repoRoot,
        timeoutMs: repoConfig.timeoutMs,
        prompt
      });

      if (!local.ok) {
        await emitReviewResult("FAIL", [
          {
            path: "package.json",
            severity: "minor",
            title: "Local agent review failed",
            message: local.errorMessage
          }
        ]);
        return 1;
      }

      const localMarkdownWithUpdateNotice = (() => {
        const notice = getOutdatedNoticeText(updateStatus);
        if (!notice) return local.markdown;
        const findingBlock = `### gitpreflight\n\n#### Update available\nPath: gitpreflight\nSeverity: note\nAgreement: 3/3\n\n${notice}`;
        if (local.markdown.includes("\n## Findings\n")) {
          return `${local.markdown.trimEnd()}\n\n${findingBlock}\n`;
        }
        return `${local.markdown.trimEnd()}\n\n## Findings\n\n${findingBlock}\n`;
      })();

      await emit(localMarkdownWithUpdateNotice);
      return local.status === "FAIL" ? 1 : 0;
    }

    // SaaS review: send staged patch to server.
    if (apiBaseUrl) {
      const token = (() => {
        try {
          return loadToken();
        } catch {
          return null;
        }
      })();

      if (token) {
        const originUrl = getOriginUrl(repoRoot);
        const normalizedOriginUrl = originUrl ? normalizeOriginUrl(originUrl) : null;
        const defaultBranch = getDefaultBranchFromOrigin(repoRoot);

        if (originUrl && normalizedOriginUrl) {
          // Best-effort: register the repo (non-blocking).
          try {
            const apiClient = new GitPreflightApiClient({ baseUrl: apiBaseUrl, token, timeoutMs: repoConfig.timeoutMs });
            await apiClient.postJson<{ repoId: string }>("/api/v1/repos/register", {
              originUrl,
              normalizedOriginUrl,
              defaultBranch: defaultBranch ?? undefined
            });
          } catch {
            // ignore
          }
        }

        const apiClient = new GitPreflightApiClient({ baseUrl: apiBaseUrl, token, timeoutMs: repoConfig.timeoutMs });
        try {
          const remote = await apiClient.postJson<import("@gitpreflight/core").ReviewResult>("/api/v1/review", {
            originUrl: originUrl ?? undefined,
            normalizedOriginUrl: normalizedOriginUrl ?? undefined,
            branch,
            planTier: "free",
            stagedPatch: reviewPatch,
            stagedFiles: reviewFiles.map((f) => ({
              path: f.path,
              changeType: f.changeType,
              isBinary: f.isBinary
            })),
            instructionFiles: hashFilesSha256(repoRoot, discovered.uniqueInstructionFiles).hashed.map((h) => ({
              path: h.path,
              sha256: h.sha256
            }))
          });

          if (remote.status === "UNCHECKED") {
            if (mode === "staged") {
              writePendingNextCommit(repoRoot, {
                branch,
                createdAtMs: Date.now(),
                reason: "server_unchecked"
              });
            } else {
              const state = readPendingState(repoRoot);
              const list = state.branches[branch] ?? [];
              const existing = new Set(list.map((p) => p.sha));
              const shas = pushCommitShas.length > 0 ? pushCommitShas : headSha ? [headSha] : [];
              for (const sha of shas) {
                if (!existing.has(sha)) list.push({ sha, createdAtMs: Date.now(), reason: "server_unchecked" });
              }
              state.branches[branch] = list;
              writePendingState(repoRoot, state);
            }

            await emitReviewResult(
              "UNCHECKED",
              remote.findings.length > 0
                ? remote.findings
                : [
                    {
                      path: "package.json",
                      severity: "note",
                      title: "Unchecked review",
                      message:
                        mode === "push"
                          ? "GitPreflight could not complete the review. Push is allowed, but GitPreflight will require reviewing these commits before the next push on this branch."
                          : "GitPreflight could not complete the review. Commit is allowed, but GitPreflight will require reviewing this commit before the next commit on this branch."
                    }
                  ]
            );
            return 0;
          }

          findings = findings.concat(remote.findings);
        } catch (err) {
          if (err instanceof GitPreflightApiError && err.status === 401) {
            findings.push({
              path: "package.json",
              severity: "minor",
              title: "Authentication failed",
              message: "GitPreflight API rejected your token. Run `gitpreflight auth login` to re-authenticate."
            });
          } else {
            throw err;
          }
        }
      }
    }

    const status = findings.some((f) => f.severity === "minor" || f.severity === "major") ? "FAIL" : "PASS";
    await emitReviewResult(status, findings);
    return status === "FAIL" ? 1 : 0;
  } catch (err) {
    if (isOfflineOrTimeoutError(err)) {
      if (mode === "staged") {
        writePendingNextCommit(repoRoot, {
          branch,
          createdAtMs: Date.now(),
          reason: (err as Error).message ?? "offline/timeout"
        });
      } else {
        const input = (() => {
          try {
            return collectPushReviewInputFromHook(repoRoot, {
              remoteName: pushRemoteName,
              stdin: pushStdin,
              headSha: headSha!
            });
          } catch {
            return { patch: "", files: [], commitShas: [], inferredBranch: null };
          }
        })();
        const state = readPendingState(repoRoot);
        const list = state.branches[branch] ?? [];
        const existing = new Set(list.map((p) => p.sha));
        const shas = input.commitShas.length > 0 ? input.commitShas : headSha ? [headSha] : [];
        for (const sha of shas) {
          if (!existing.has(sha)) list.push({ sha, createdAtMs: Date.now(), reason: (err as Error).message ?? "offline/timeout" });
        }
        state.branches[branch] = list;
        writePendingState(repoRoot, state);
      }

      await emitReviewResult("UNCHECKED", [
        {
          path: "package.json",
          severity: "note",
          title: "Unchecked review",
          message:
            mode === "push"
              ? "GitPreflight could not complete the review (offline/timeout). Push is allowed, but GitPreflight will require reviewing these commits before the next push on this branch."
              : "GitPreflight could not complete the review (offline/timeout). Commit is allowed, but GitPreflight will require reviewing this commit before the next commit on this branch."
        }
      ]);
      return 0;
    }

    process.stderr.write(`GitPreflight internal error: ${(err as Error).message}\n`);
    return 2;
  }
}

async function cmdInit(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    options: {
      hook: { type: "string" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true
  });

  if (parsed.values.help) {
    process.stdout.write("Usage: gitpreflight init [--hook pre-commit|pre-push|both]\n");
    return 0;
  }

  async function promptInitHookMode(): Promise<InitHookMode> {
    const stdinIsTty = Boolean(process.stdin.isTTY);
    const stdoutIsTty = Boolean(process.stdout.isTTY);
    if (!stdinIsTty || !stdoutIsTty) return "pre-commit";

    return await interactiveSelect<InitHookMode>({
      title: "GitPreflight init",
      prompt: "How do you want GitPreflight to run?",
      options: [
        {
          value: "pre-commit",
          label: "On commit (pre-commit) [recommended]",
          description: "Review staged changes before each commit."
        },
        {
          value: "pre-push",
          label: "On push (pre-push)",
          description: "Review commit range before each push."
        },
        {
          value: "both",
          label: "Both",
          description: "Install both pre-commit and pre-push checks."
        }
      ],
      defaultValue: "pre-commit"
    });
  }

  const hookFlag = parsed.values.hook as string | undefined;
  let selectedHookMode: InitHookMode;

  if (!hookFlag) {
    try {
      selectedHookMode = await promptInitHookMode();
    } catch {
      process.stderr.write("Init canceled.\n");
      return 1;
    }
  } else if (hookFlag === "pre-commit" || hookFlag === "pre-push" || hookFlag === "both") {
    selectedHookMode = hookFlag;
  } else {
    process.stderr.write(`Invalid --hook value: ${hookFlag}. Expected pre-commit, pre-push, or both.\n`);
    return 2;
  }

  let repoRoot: string;
  try {
    repoRoot = getRepoRoot();
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }

  try {
    initRepo(repoRoot, { hook: selectedHookMode });
  } catch (err) {
    process.stderr.write(`Failed to initialize GitPreflight: ${(err as Error).message}\n`);
    return 2;
  }

  process.stdout.write("Initialized GitPreflight (Husky hooks + package.json updates).\n");
  process.stdout.write("Next: run your package manager install so the prepare script can run `husky install`.\n");
  return 0;
}

function parseHookFlag(hookFlag: string | undefined): InitHookMode | null {
  if (!hookFlag) return null;
  if (hookFlag === "pre-commit" || hookFlag === "pre-push" || hookFlag === "both") return hookFlag;
  return null;
}

function parseScopeFlag(scopeFlag: string | undefined): InstallScope | null {
  if (!scopeFlag) return null;
  if (scopeFlag === "global" || scopeFlag === "local" || scopeFlag === "repo") return scopeFlag;
  return null;
}

function parseLocalAgentProviderFlag(providerFlag: string | undefined): LocalAgentProvider | null {
  if (!providerFlag) return null;
  if (providerFlag === "codex" || providerFlag === "claude" || providerFlag === "opencode") return providerFlag;
  return null;
}

async function promptLocalAgentProvider(title: string): Promise<LocalAgentProvider> {
  return await interactiveSelect<LocalAgentProvider>({
    title,
    prompt: "Which local agent are you using?",
    options: [
      {
        value: "codex",
        label: "Codex",
        description: "Use the `codex` command."
      },
      {
        value: "claude",
        label: "Claude",
        description: "Use the `claude` command."
      },
      {
        value: "opencode",
        label: "OpenCode",
        description: "Use the `opencode run` command."
      }
    ],
    defaultValue: "codex"
  });
}

function probeAndSaveLocalAgent(provider: LocalAgentProvider, rerunCommand: string): boolean {
  const command = getDefaultLocalAgentCommand(provider);
  process.stdout.write(`\nProbing local agent command: ${command}\n`);
  const probe = probeLocalAgentCommand({
    command,
    cwd: process.cwd(),
    timeoutMs: 20_000
  });

  if (!probe.ok) {
    process.stderr.write("Local-agent probe failed. Configuration was not saved.\n");
    process.stderr.write(`Command: ${command}\n`);
    if (probe.exitCode !== null) process.stderr.write(`Exit code: ${probe.exitCode}\n`);
    process.stderr.write(`Reason: ${probe.message}\n`);
    if (probe.stderr) process.stderr.write(`stderr: ${probe.stderr}\n`);
    process.stderr.write(`Make sure the command is installed and available in your PATH, then rerun ${rerunCommand}.\n`);
    return false;
  }

  saveLocalAgentConfig({ provider, command });
  process.stdout.write(`Saved local-agent config (${provider}: ${command}).\n`);
  return true;
}

async function promptInstallFallback(): Promise<{ scope: InstallScope; hook: InitHookMode; provider: LocalAgentProvider }> {
  const scope = await interactiveSelect<InstallScope>({
    title: "GitPreflight setup",
    prompt: "Choose scope:",
    options: [
      {
        value: "global",
        label: "global",
        description: "Enable GitPreflight for all repos on this machine."
      },
      {
        value: "local",
        label: "local",
        description: "Enable only for this repo using local .git config."
      },
      {
        value: "repo",
        label: "repo",
        description: "Commit Husky integration files for team setup."
      }
    ],
    defaultValue: "local"
  });

  const hook = await interactiveSelect<InitHookMode>({
    title: "GitPreflight setup",
    prompt: "Choose hook mode:",
    options: [
      {
        value: "pre-commit",
        label: "pre-commit",
        description: "Review staged changes at commit time."
      },
      {
        value: "pre-push",
        label: "pre-push",
        description: "Review pushed commit range at push time."
      },
      {
        value: "both",
        label: "both",
        description: "Install both pre-commit and pre-push checks."
      }
    ],
    defaultValue: "pre-commit"
  });

  const provider = await promptLocalAgentProvider("GitPreflight setup");

  return { scope, hook, provider };
}

async function cmdSetupScope(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    options: {
      scope: { type: "string" },
      hook: { type: "string" },
      agent: { type: "string" },
      yes: { type: "boolean" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: false
  });

  if (parsed.values.help) {
    process.stdout.write(
      "Usage: gitpreflight setup [--scope global|local|repo] [--hook pre-commit|pre-push|both] [--agent codex|claude|opencode] [--yes]\n"
    );
    return 0;
  }

  const scopeFlag = parseScopeFlag(parsed.values.scope as string | undefined);
  const hookFlag = parseHookFlag(parsed.values.hook as string | undefined);
  const providerFlag = parseLocalAgentProviderFlag(parsed.values.agent as string | undefined);
  const autoYes = Boolean(parsed.values.yes);

  if ((parsed.values.scope as string | undefined) && !scopeFlag) {
    process.stderr.write(`Invalid --scope value: ${parsed.values.scope}. Expected global, local, or repo.\n`);
    return 2;
  }

  if ((parsed.values.hook as string | undefined) && !hookFlag) {
    process.stderr.write(`Invalid --hook value: ${parsed.values.hook}. Expected pre-commit, pre-push, or both.\n`);
    return 2;
  }

  if ((parsed.values.agent as string | undefined) && !providerFlag) {
    process.stderr.write(`Invalid --agent value: ${parsed.values.agent}. Expected codex, claude, or opencode.\n`);
    return 2;
  }

  let scope = scopeFlag;
  let hook: InitHookMode = hookFlag ?? "pre-commit";
  let provider = providerFlag;

  if (!scope) {
    if (autoYes) {
      scope = "local";
    } else if (process.stdin.isTTY && process.stdout.isTTY) {
      const isBunRuntime = typeof (globalThis as any).Bun !== "undefined";
      if (isBunRuntime) {
        try {
          const choice = await runInstallWizardTui();
          scope = choice.scope;
          hook = choice.hook;
        } catch {
          process.stderr.write("Install canceled.\n");
          return 1;
        }
      } else {
        try {
          const choice = await promptInstallFallback();
          scope = choice.scope;
          hook = choice.hook;
          provider = choice.provider;
        } catch {
          process.stderr.write("Install canceled.\n");
          return 1;
        }
      }
    } else {
      process.stderr.write("Non-interactive setup requires --scope (global|local|repo).\n");
      return 2;
    }
  }

  if (!provider) {
    if (autoYes) {
      process.stderr.write("Non-interactive setup requires --agent (codex|claude|opencode).\n");
      return 2;
    }

    if (process.stdin.isTTY && process.stdout.isTTY) {
      try {
        provider = await promptLocalAgentProvider("GitPreflight setup");
      } catch {
        process.stderr.write("Setup canceled.\n");
        return 1;
      }
    } else {
      process.stderr.write("Non-interactive setup requires --agent (codex|claude|opencode).\n");
      return 2;
    }
  }

  if (!probeAndSaveLocalAgent(provider, "`gitpreflight setup`")) {
    return 1;
  }

  try {
    if (scope === "global") {
      installGlobalScope({ hook });
      process.stdout.write(`Installed GitPreflight globally (${hook}).\n`);
    } else if (scope === "local") {
      const repoRoot = getRepoRoot();
      installLocalScope(repoRoot, { hook });
      process.stdout.write(`Installed GitPreflight locally for this repo (${hook}).\n`);
    } else {
      const repoRoot = getRepoRoot();
      installRepoScope(repoRoot, { hook });
      process.stdout.write("Installed GitPreflight in repo mode (Husky + package.json updates).\n");
      process.stdout.write("Next: run your package manager install so the prepare script can run `husky install`.\n");
    }
  } catch (err) {
    process.stderr.write(`Install failed: ${(err as Error).message}\n`);
    return 2;
  }

  process.stdout.write("You can now run `gitpreflight review --staged`.\n");
  markOnboardingNoticeShown();
  return 0;
}

async function cmdUninstall(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    options: {
      scope: { type: "string" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: false
  });

  if (parsed.values.help) {
    process.stdout.write("Usage: gitpreflight uninstall --scope global|local\n");
    return 0;
  }

  const scope = parseScopeFlag(parsed.values.scope as string | undefined);
  if (!scope || scope === "repo") {
    process.stderr.write("Uninstall supports --scope global|local. For repo mode, remove Husky hooks and package.json entries manually.\n");
    return 2;
  }

  try {
    if (scope === "global") {
      uninstallGlobalScope();
      process.stdout.write("Removed global GitPreflight setup (if present).\n");
    } else {
      const repoRoot = getRepoRoot();
      uninstallLocalScope(repoRoot);
      process.stdout.write("Removed local GitPreflight setup for this repo (if present).\n");
    }
  } catch (err) {
    process.stderr.write(`Uninstall failed: ${(err as Error).message}\n`);
    return 2;
  }

  return 0;
}

async function cmdStatus(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    options: {
      verbose: { type: "boolean" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: false
  });

  if (parsed.values.help) {
    process.stdout.write("Usage: gitpreflight status [--verbose]\n");
    return 0;
  }

  let repoRoot: string | null = null;
  try {
    repoRoot = getRepoRoot();
  } catch {
    repoRoot = null;
  }

  const status = getInstallStatus(repoRoot);
  const policy = resolvePolicy(repoRoot);

  process.stdout.write(`Global setup: ${status.global.installed ? "enabled" : "disabled"}\n`);
  if (parsed.values.verbose) {
    process.stdout.write(`  global hooksPath: ${status.global.hooksPath ?? "(unset)"}\n`);
    process.stdout.write(`  managed hooksPath: ${status.global.managedHooksPath}\n`);
  }

  if (repoRoot) {
    process.stdout.write(`Local setup (this repo): ${status.local.installed ? "enabled" : "disabled"}\n`);
    process.stdout.write(`Repo setup (committed): ${status.repo.installed ? "enabled" : "disabled"}\n`);
    if (parsed.values.verbose) {
      process.stdout.write(`  local hooksPath: ${status.local.hooksPath ?? "(unset)"}\n`);
      process.stdout.write(`  managed local hooksPath: ${status.local.managedHooksPath ?? "(n/a)"}\n`);
    }
  } else {
    process.stdout.write("Local/repo setup: unknown (not inside a git repository)\n");
  }

  process.stdout.write(`Effective scope: ${status.effectiveScope ?? "none"}\n`);
  process.stdout.write(`Effective policy: ${policy.effective.policy} (source: ${policy.effective.source})\n`);
  if (parsed.values.verbose) {
    process.stdout.write(`  configured repo policy: ${policy.configured.repo ?? "(unset)"}\n`);
    process.stdout.write(`  configured local policy: ${policy.configured.local ?? "(unset)"}\n`);
    process.stdout.write(`  configured global policy: ${policy.configured.global ?? "(unset)"}\n`);
    if (policy.ignored.local || policy.ignored.global) {
      const ignored: string[] = [];
      if (policy.ignored.local) ignored.push("local");
      if (policy.ignored.global) ignored.push("global");
      process.stdout.write(`  ignored overrides: ${ignored.join(", ")}\n`);
    }
  }
  return status.effectiveScope ? 0 : 1;
}

async function cmdAuth(argv: string[]) {
  const sub = argv[0];
  if (sub === "login") {
    const parsed = parseArgs({
      args: argv.slice(1),
      options: {
        help: { type: "boolean", short: "h" }
      },
      allowPositionals: true
    });

    if (parsed.values.help) {
      process.stdout.write("Usage: gitpreflight auth login\n");
      return 0;
    }

    try {
      let env = process.env as NodeJS.ProcessEnv;
      try {
        const repoRoot = getRepoRoot();
        env = { ...env, ...loadRepoEnv(repoRoot) } as NodeJS.ProcessEnv;
      } catch {
        // auth login can run outside a repo; fall back to process env
      }

      const parsedEnv = getGitPreflightEnv(env);
      await deviceAuthLogin(parsedEnv.GITPREFLIGHT_API_BASE_URL);
      process.stdout.write("GitPreflight CLI authenticated.\n");
      return 0;
    } catch (err) {
      process.stderr.write(`Auth failed: ${(err as Error).message}\n`);
      return 2;
    }
  }

  process.stderr.write("Usage: gitpreflight auth login\n");
  return 2;
}

async function cmdSetupLocalAgent(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    options: {
      agent: { type: "string" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true
  });

  if (parsed.values.help) {
    process.stdout.write("Usage: gitpreflight setup local-agent [--agent codex|claude|opencode]\n");
    return 0;
  }

  const providerFlag = parseLocalAgentProviderFlag(parsed.values.agent as string | undefined);
  if ((parsed.values.agent as string | undefined) && !providerFlag) {
    process.stderr.write(`Invalid --agent value: ${parsed.values.agent}. Expected codex, claude, or opencode.\n`);
    return 2;
  }

  if (!providerFlag && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    process.stderr.write("`gitpreflight setup local-agent` requires a TTY or --agent.\n");
    return 2;
  }

  let provider: LocalAgentProvider | null = providerFlag;
  try {
    if (!provider) {
      provider = await promptLocalAgentProvider("GitPreflight local-agent setup");
    }
  } catch {
    process.stderr.write("Setup canceled.\n");
    return 1;
  }

  if (!provider) {
    process.stderr.write("Missing local agent provider.\n");
    return 2;
  }

  if (!probeAndSaveLocalAgent(provider, "`gitpreflight setup local-agent`")) {
    return 1;
  }

  process.stdout.write("You can now run `gitpreflight review --staged`.\n");
  return 0;
}

async function cmdSetup(argv: string[]) {
  const sub = argv[0];
  if (sub === "local-agent") {
    return cmdSetupLocalAgent(argv.slice(1));
  }

  return cmdSetupScope(argv);
}

async function cmdInternal(argv: string[]) {
  const sub = argv[0];

  if (sub === "post-commit") {
    let repoRoot: string;
    try {
      repoRoot = getRepoRoot();
    } catch {
      return 0;
    }

    return runPostCommit(repoRoot);
  }

  process.stderr.write("Usage: gitpreflight internal post-commit\n");
  return 2;
}

async function cmdSkipNext(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    options: {
      reason: { type: "string" },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true
  });

  if (parsed.values.help) {
    process.stdout.write("Usage: gitpreflight skip-next --reason \"...\"\n");
    return 0;
  }

  const reason = parsed.values.reason ?? "(no reason provided)";

  let repoRoot: string;
  try {
    repoRoot = getRepoRoot();
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }

  writeSkipNext(repoRoot, { reason, createdAtMs: Date.now() });
  process.stdout.write(`GitPreflight will skip the next hook run. Reason: ${reason}\n`);
  return 0;
}

export async function runCli(argv: string[] = process.argv.slice(2)) {
  const [cmd, ...rest] = argv;

  const env = process.env;
  const inCi = env.CI === "1" || env.CI === "true" || env.GITHUB_ACTIONS === "1" || env.GITHUB_ACTIONS === "true";
  const inHook = env.GITPREFLIGHT_HOOK === "1" || Boolean(env.GIT_DIR);

  let repoRootForStatus: string | null = null;
  try {
    repoRootForStatus = getRepoRoot();
  } catch {
    repoRootForStatus = null;
  }

  const installStatus = getInstallStatus(repoRootForStatus);
  if (
    shouldShowOnboardingNotice({
      cmd,
      inCi,
      inHook,
      status: installStatus
    })
  ) {
    process.stderr.write(`${onboardingNoticeText()}\n`);
    markOnboardingNoticeShown();
  }

  if (!cmd || cmd === "--help" || cmd === "-h") {
    printHelp();
    return 0;
  }

  if (cmd === "--version" || cmd === "-v") return await cmdVersion({ inCi, inHook });
  if (cmd === "version") return await cmdVersion({ inCi, inHook });

  if (cmd !== "review") {
    const updateStatus = await resolveCliUpdateStatus({
      currentVersion: GITPREFLIGHT_CLI_VERSION,
      inCi,
      inHook
    });
    const updateNotice = getOutdatedNoticeText(updateStatus);
    if (updateNotice) {
      process.stderr.write(`${updateNotice}\n`);
    }
  }

  if (cmd === "review") return await cmdReview(rest);
  if (cmd === "setup") return await cmdSetup(rest);
  if (cmd === "uninstall") return await cmdUninstall(rest);
  if (cmd === "status") return await cmdStatus(rest);
  if (cmd === "init") return await cmdInit(rest);
  if (cmd === "auth") return await cmdAuth(rest);
  if (cmd === "skip-next") return await cmdSkipNext(rest);
  if (cmd === "internal") return await cmdInternal(rest);

  return unknownCommand(cmd);
}

if (require.main === module) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
