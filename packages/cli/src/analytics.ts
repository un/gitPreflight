import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { ensureGitPreflightConfigDir, migrateLegacyMacConfigIfNeeded, getGitPreflightConfigDir } from "./configPaths";

declare const __GITPREFLIGHT_TELEMETRY_BASE_URL__: string | undefined;

const DEFAULT_TELEMETRY_BASE_URL = "https://gitpreflight.ai";
const TELEMETRY_TIMEOUT_MS = 1_500;

const BUILTIN_TELEMETRY_BASE_URL =
  typeof __GITPREFLIGHT_TELEMETRY_BASE_URL__ === "string" ? __GITPREFLIGHT_TELEMETRY_BASE_URL__.trim() : "";

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function isFalsy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "0" || v === "false" || v === "no";
}

function telemetryEnabled(env: NodeJS.ProcessEnv): boolean {
  if (isTruthy(env.GITPREFLIGHT_DISABLE_ANON_TELEMETRY)) return false;
  if (isFalsy(env.GITPREFLIGHT_ANON_TELEMETRY)) return false;
  return true;
}

function telemetryBaseUrl(env: NodeJS.ProcessEnv): string {
  const raw =
    env.GITPREFLIGHT_TELEMETRY_BASE_URL?.trim() ||
    env.GITPREFLIGHT_API_BASE_URL?.trim() ||
    BUILTIN_TELEMETRY_BASE_URL ||
    DEFAULT_TELEMETRY_BASE_URL;
  return raw.replace(/\/+$/, "");
}

function installIdPath(): string {
  return join(getGitPreflightConfigDir(), "install-id");
}

function isValidInstallId(value: string): boolean {
  return value.length >= 16 && value.length <= 128;
}

function generateInstallId(): string {
  try {
    const id = randomUUID();
    if (id && id.length > 0) return id;
  } catch {
    // Fall through.
  }
  return randomBytes(16).toString("hex");
}

function loadOrCreateInstallId(): string {
  migrateLegacyMacConfigIfNeeded();
  const path = installIdPath();

  try {
    const existing = readFileSync(path, "utf8").trim();
    if (isValidInstallId(existing)) return existing;
  } catch {
    // Fall through.
  }

  ensureGitPreflightConfigDir();
  const next = generateInstallId();
  writeFileSync(path, `${next}\n`, "utf8");
  try {
    chmodSync(path, 0o600);
  } catch {
    // best-effort
  }
  return next;
}

async function postAnonymousEvent(path: string, body: unknown, env: NodeJS.ProcessEnv): Promise<void> {
  if (!telemetryEnabled(env)) return;

  const baseUrl = telemetryBaseUrl(env);
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), TELEMETRY_TIMEOUT_MS);

  try {
    await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal
    });
  } catch {
    // Best-effort telemetry only.
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendUsageReviewEvent(opts: {
  env?: NodeJS.ProcessEnv;
}) {
  try {
    const env = opts.env ?? process.env;
    const installId = loadOrCreateInstallId();
    await postAnonymousEvent(
      "/api/v1/usage/review",
      {
        installId
      },
      env
    );
  } catch {
    // Best-effort telemetry only.
  }
}
