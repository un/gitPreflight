import { spawnSync } from "node:child_process";
import { OPENCODE_PROVIDER_DISCOVERY_SCRIPT } from "./opencodeProviderDiscoveryScript";

export type LocalAgentRunResult =
  | {
      ok: true;
      markdown: string;
      status: "PASS" | "FAIL" | "UNCHECKED";
      usedFallback?: boolean;
      fallbackModel?: string;
      primaryError?: string;
    }
  | { ok: false; errorMessage: string };

export type LocalAgentProbeResult =
  | { ok: true; stdout: string }
  | {
      ok: false;
      reason: "spawn_error" | "exit_nonzero" | "empty_output" | "error_output";
      message: string;
      exitCode: number | null;
      stderr: string;
    };

function stripAnsi(text: string): string {
  return text.replace(/[\u001B\u009B][[\]()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]/g, "");
}

function normalizeOutput(text: string): string {
  return stripAnsi(text).replace(/\r\n?/g, "\n");
}

function parseResultStatus(markdown: string): "PASS" | "FAIL" | "UNCHECKED" | null {
  const m = markdown.match(/^(?:\*\*)?Result:(?:\*\*)?\s*(PASS|FAIL|UNCHECKED)\s*$/m);
  return (m?.[1] as any) ?? null;
}

function looksLikeGitpreflightMarkdown(markdown: string): boolean {
  const hasHeader = /^#\s+GitPreflight\s+Review\s*$/m.test(markdown);
  const hasCounts = /^(?:\*\*)?Counts:(?:\*\*)?\s*note=\d+\s+minor=\d+\s+major=\d+\s*$/m.test(markdown);
  const hasFindingsHeader = /^##\s+Findings\s*$/m.test(markdown);
  return hasHeader && hasCounts && hasFindingsHeader;
}

function extractErrorLine(text: string): string | null {
  const lines = normalizeOutput(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    const cleaned = line.replace(/^>\s*/, "");
    if (/^error:/i.test(cleaned)) return cleaned;
  }

  return null;
}

function extractContractMarkdownFromText(text: string): string | null {
  const normalized = normalizeOutput(text).trim();
  if (!normalized) return null;

  const candidates: string[] = [normalized];

  const headerIndex = normalized.indexOf("# GitPreflight Review");
  if (headerIndex > 0) {
    candidates.unshift(normalized.slice(headerIndex).trim());
  }

  const fencePattern = /```(?:markdown|md)?\n([\s\S]*?)```/gi;
  let fenceMatch: RegExpExecArray | null;
  while ((fenceMatch = fencePattern.exec(normalized)) !== null) {
    candidates.push(fenceMatch[1]!.trim());
  }

  for (const candidate of candidates) {
    const status = parseResultStatus(candidate);
    if (status && looksLikeGitpreflightMarkdown(candidate)) {
      return candidate.trimEnd();
    }
  }

  return null;
}

function extractContractMarkdown(stdout: string, stderr: string): string | null {
  return (
    extractContractMarkdownFromText(stdout) ??
    extractContractMarkdownFromText(stderr) ??
    extractContractMarkdownFromText(`${stdout}\n${stderr}`)
  );
}

function parseCommandTokens(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean);
}

function isOpencodeRunCommand(command: string): boolean {
  const tokens = parseCommandTokens(command);
  return tokens[0] === "opencode" && tokens[1] === "run";
}

function shouldIsolateOpencodeEnv(command: string): boolean {
  const tokens = parseCommandTokens(command);
  return tokens[0] === "opencode";
}

function hasExplicitModelFlag(command: string): boolean {
  return /(?:^|\s)(?:-m|--model)(?:\s|=)/.test(command);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function appendModelFlag(command: string, model: string): string {
  return `${command} --model ${shellQuote(model)}`;
}

function isModelFallbackEnabled(): boolean {
  return process.env.GITPREFLIGHT_LOCAL_AGENT_DISABLE_FALLBACK !== "1";
}

function buildOpencodePermissionValue(existingRaw: string | undefined): string {
  const base: Record<string, unknown> = { question: "deny" };
  if (!existingRaw) return JSON.stringify(base);

  try {
    const parsed = JSON.parse(existingRaw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return JSON.stringify(parsed as Record<string, unknown>);
    }
  } catch {
    // ignore and fall back to base policy
  }

  return JSON.stringify(base);
}

function spawnEnvForCommand(command: string): NodeJS.ProcessEnv {
  if (!shouldIsolateOpencodeEnv(command)) return process.env;

  const env = { ...process.env };

  delete env.OPENCODE;
  delete env.OPENCODE_CLIENT;
  delete env.OPENCODE_SERVER_URL;
  delete env.OPENCODE_SERVER_SESSION;
  delete env.OPENCODE_SERVER_USERNAME;
  delete env.OPENCODE_SERVER_PASSWORD;

  env.OPENCODE_PERMISSION = buildOpencodePermissionValue(process.env.OPENCODE_PERMISSION);

  return env;
}

function listOpencodeModels(opts: {
  cwd: string;
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
  provider?: string;
}): string[] {
  const cmd = opts.provider ? `opencode models ${shellQuote(opts.provider)}` : "opencode models";
  const res = spawnSync(cmd, {
    cwd: opts.cwd,
    shell: true,
    env: opts.env,
    encoding: "utf8",
    timeout: Math.min(opts.timeoutMs, 20_000),
    maxBuffer: 10 * 1024 * 1024
  });

  if (res.error) return [];
  if (typeof res.status === "number" && res.status !== 0) return [];

  const raw = `${(res.stdout ?? "").toString()}\n${(res.stderr ?? "").toString()}`;
  const lines = normalizeOutput(raw)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[a-z0-9-]+\/[A-Za-z0-9._-]+$/.test(line));

  return Array.from(new Set(lines));
}

type OpencodeProviderSnapshot = {
  connected: string[];
  defaults: Record<string, string>;
};

function fetchOpencodeProviderSnapshot(opts: {
  cwd: string;
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
}): OpencodeProviderSnapshot | null {
  if (process.platform === "win32") return null;

  const env = { ...opts.env };
  const existingPath = env.PATH || process.env.PATH;
  if (existingPath) env.PATH = existingPath;
  env.GPF_DISCOVERY_CWD = opts.cwd;
  env.GPF_DISCOVERY_TIMEOUT_MS = String(Math.max(4_000, Math.min(opts.timeoutMs, 15_000)));

  const res = spawnSync(process.execPath, ["-e", OPENCODE_PROVIDER_DISCOVERY_SCRIPT], {
    cwd: opts.cwd,
    env,
    encoding: "utf8",
    timeout: Math.max(6_000, Math.min(opts.timeoutMs, 18_000)),
    maxBuffer: 10 * 1024 * 1024
  });

  if (res.error) return null;
  if (typeof res.status === "number" && res.status !== 0) return null;

  const payload = normalizeOutput((res.stdout ?? "").toString()).trim();
  if (!payload) return null;

  try {
    const parsed = JSON.parse(payload) as OpencodeProviderSnapshot;
    if (!parsed || typeof parsed !== "object") return null;

    const connected = Array.isArray(parsed.connected) ? parsed.connected.filter((v) => typeof v === "string") : [];
    const defaults: Record<string, string> = {};

    if (parsed.defaults && typeof parsed.defaults === "object" && !Array.isArray(parsed.defaults)) {
      for (const [provider, model] of Object.entries(parsed.defaults)) {
        if (typeof provider === "string" && typeof model === "string") {
          defaults[provider] = model;
        }
      }
    }

    return { connected, defaults };
  } catch {
    return null;
  }
}

function toProviderQualifiedModel(provider: string, model: string): string {
  return model.includes("/") ? model : `${provider}/${model}`;
}

function collectOpencodeFallbackModels(opts: { cwd: string; timeoutMs: number; env: NodeJS.ProcessEnv }): string[] {
  const providersInOrder = ["opencode", "openai", "azure", "anthropic"];
  const ordered: string[] = [];

  const snapshot = fetchOpencodeProviderSnapshot(opts);
  if (snapshot) {
    const connectedSet = new Set(snapshot.connected);
    const connectedOrdered = [
      ...providersInOrder.filter((provider) => connectedSet.has(provider)),
      ...snapshot.connected.filter((provider) => !providersInOrder.includes(provider))
    ];

    for (const provider of connectedOrdered) {
      const model = snapshot.defaults[provider];
      if (!model) continue;
      ordered.push(toProviderQualifiedModel(provider, model));
    }
  }

  const opencodeModels = listOpencodeModels({ ...opts, provider: "opencode" }).filter((model) =>
    model.startsWith("opencode/")
  );
  if (opencodeModels.length) {
    if (!ordered.some((model) => model.startsWith("opencode/"))) {
      ordered.push(opencodeModels[0]!);
    }
    ordered.push(...opencodeModels.slice(0, 3));
  }

  if (ordered.length === 0) {
    for (const provider of providersInOrder) {
      const scoped = listOpencodeModels({ ...opts, provider });
      const providerModels = scoped.filter((model) => model.startsWith(`${provider}/`));
      if (providerModels.length) ordered.push(providerModels[0]!);
    }
  }

  return Array.from(new Set(ordered)).slice(0, 8);
}

type ReviewAttempt = {
  result: LocalAgentRunResult;
  stdout: string;
  stderr: string;
  normalizedStdout: string;
  normalizedStderr: string;
};

function runMarkdownReviewAttempt(opts: {
  command: string;
  cwd: string;
  timeoutMs: number;
  prompt: string;
}): ReviewAttempt {
  const res = spawnSync(opts.command, {
    cwd: opts.cwd,
    shell: true,
    env: spawnEnvForCommand(opts.command),
    input: opts.prompt,
    encoding: "utf8",
    timeout: opts.timeoutMs,
    maxBuffer: 10 * 1024 * 1024
  });

  if (res.error) {
    return {
      result: { ok: false, errorMessage: res.error.message },
      stdout: "",
      stderr: "",
      normalizedStdout: "",
      normalizedStderr: ""
    };
  }

  const stdout = (res.stdout ?? "").toString();
  const stderr = (res.stderr ?? "").toString();
  const normalizedStdout = normalizeOutput(stdout).trim();
  const normalizedStderr = normalizeOutput(stderr).trim();

  if (typeof res.status === "number" && res.status !== 0) {
    const msg = normalizedStderr ? `Command failed: ${normalizedStderr}` : `Command failed with exit code ${res.status}`;
    return {
      result: { ok: false, errorMessage: msg },
      stdout,
      stderr,
      normalizedStdout,
      normalizedStderr
    };
  }

  const markdown = extractContractMarkdown(stdout, stderr);
  if (!markdown) {
    const errorLine = extractErrorLine(`${stderr}\n${stdout}`);
    if (errorLine) {
      return {
        result: { ok: false, errorMessage: `Command failed: ${errorLine}` },
        stdout,
        stderr,
        normalizedStdout,
        normalizedStderr
      };
    }

    if (!normalizedStdout && !normalizedStderr) {
      return {
        result: { ok: false, errorMessage: "Local agent command produced empty output." },
        stdout,
        stderr,
        normalizedStdout,
        normalizedStderr
      };
    }

    return {
      result: {
        ok: false,
        errorMessage:
          "Local agent output did not match the GitPreflight Markdown contract (missing required header/Counts/Findings/Result lines)."
      },
      stdout,
      stderr,
      normalizedStdout,
      normalizedStderr
    };
  }

  const status = parseResultStatus(markdown);
  if (!status) {
    return {
      result: {
        ok: false,
        errorMessage:
          "Local agent output did not include a valid `Result: PASS|FAIL|UNCHECKED` line in the GitPreflight Markdown contract."
      },
      stdout,
      stderr,
      normalizedStdout,
      normalizedStderr
    };
  }

  return {
    result: { ok: true, markdown, status },
    stdout,
    stderr,
    normalizedStdout,
    normalizedStderr
  };
}

export function runLocalAgentMarkdownReview(opts: {
  command: string;
  cwd: string;
  timeoutMs: number;
  prompt: string;
}): LocalAgentRunResult {
  const primary = runMarkdownReviewAttempt(opts);
  if (primary.result.ok) return primary.result;

  if (!isOpencodeRunCommand(opts.command) || hasExplicitModelFlag(opts.command)) {
    return primary.result;
  }

  if (!isModelFallbackEnabled()) {
    return primary.result;
  }

  const models = collectOpencodeFallbackModels({
    cwd: opts.cwd,
    timeoutMs: opts.timeoutMs,
    env: spawnEnvForCommand(opts.command)
  });

  if (!models.length) return primary.result;

  const primaryError = primary.result.errorMessage;
  let lastFallbackError = primaryError;
  const attempted: string[] = [];

  for (const model of models) {
    attempted.push(model);
    const fallback = runMarkdownReviewAttempt({ ...opts, command: appendModelFlag(opts.command, model) });
    if (fallback.result.ok) {
      return { ...fallback.result, usedFallback: true, fallbackModel: model, primaryError };
    }
    lastFallbackError = fallback.result.errorMessage;
  }

  return {
    ok: false,
    errorMessage:
      `Primary OpenCode run failed: ${primaryError}\n` +
      `Fallback attempts also failed: ${lastFallbackError}\n` +
      `Tried OpenCode model fallbacks: ${attempted.join(", ")}`
  };
}

function runProbeAttempt(opts: { command: string; cwd: string; timeoutMs: number }): LocalAgentProbeResult {
  const res = spawnSync(opts.command, {
    cwd: opts.cwd,
    shell: true,
    env: spawnEnvForCommand(opts.command),
    input: "hi are you alive",
    encoding: "utf8",
    timeout: opts.timeoutMs,
    maxBuffer: 10 * 1024 * 1024
  });

  const rawStdout = (res.stdout ?? "").toString();
  const rawStderr = (res.stderr ?? "").toString();
  const stdout = normalizeOutput(rawStdout).trim();
  const stderr = normalizeOutput(rawStderr).trim();

  if (res.error) {
    return {
      ok: false,
      reason: "spawn_error",
      message: res.error.message,
      exitCode: typeof res.status === "number" ? res.status : null,
      stderr
    };
  }

  if (typeof res.status === "number" && res.status !== 0) {
    return {
      ok: false,
      reason: "exit_nonzero",
      message: stderr || `command exited with code ${res.status}`,
      exitCode: res.status,
      stderr
    };
  }

  const errorLine = extractErrorLine(stderr);
  if (errorLine) {
    return {
      ok: false,
      reason: "error_output",
      message: errorLine,
      exitCode: typeof res.status === "number" ? res.status : null,
      stderr
    };
  }

  const output = stdout || stderr;
  if (!output) {
    return {
      ok: false,
      reason: "empty_output",
      message: "command produced empty output",
      exitCode: typeof res.status === "number" ? res.status : null,
      stderr
    };
  }

  return { ok: true, stdout: output };
}

export function probeLocalAgentCommand(opts: {
  command: string;
  cwd: string;
  timeoutMs: number;
}): LocalAgentProbeResult {
  const primary = runProbeAttempt(opts);
  if (primary.ok) return primary;

  if (!isOpencodeRunCommand(opts.command) || hasExplicitModelFlag(opts.command)) {
    return primary;
  }

  if (!isModelFallbackEnabled()) {
    return primary;
  }

  const models = collectOpencodeFallbackModels({
    cwd: opts.cwd,
    timeoutMs: opts.timeoutMs,
    env: spawnEnvForCommand(opts.command)
  });
  if (!models.length) return primary;

  const attempted: string[] = [];
  for (const model of models) {
    attempted.push(model);
    const fallback = runProbeAttempt({ ...opts, command: appendModelFlag(opts.command, model) });
    if (fallback.ok) return fallback;
  }

  return {
    ...primary,
    message:
      `Primary OpenCode probe failed: ${primary.message}; ` +
      `model fallback attempts also failed (${attempted.join(", ")})`
  };
}
