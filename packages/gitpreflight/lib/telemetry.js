"use strict";

const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const DEFAULT_TELEMETRY_BASE_URL = "https://gitpreflight.ai";

function bakedTelemetryBaseUrl() {
  try {
    const pkg = require("../package.json");
    const value = typeof pkg.gitpreflightTelemetryBaseUrl === "string" ? pkg.gitpreflightTelemetryBaseUrl.trim() : "";
    return value || null;
  } catch {
    return null;
  }
}

const BAKED_TELEMETRY_BASE_URL = bakedTelemetryBaseUrl();

function isTruthy(v) {
  if (!v) return false;
  const t = String(v).trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes";
}

function isFalsy(v) {
  if (!v) return false;
  const t = String(v).trim().toLowerCase();
  return t === "0" || t === "false" || t === "no";
}

function telemetryEnabled(env) {
  if (isTruthy(env.GITPREFLIGHT_DISABLE_ANON_TELEMETRY)) return false;
  if (isFalsy(env.GITPREFLIGHT_ANON_TELEMETRY)) return false;
  return true;
}

function configDir() {
  const xdg = process.env.XDG_CONFIG_HOME && process.env.XDG_CONFIG_HOME.trim();
  if (xdg) return path.join(xdg, "gitpreflight");
  return path.join(os.homedir(), ".config", "gitpreflight");
}

function installIdPath() {
  return path.join(configDir(), "install-id");
}

function isValidInstallId(value) {
  return typeof value === "string" && value.length >= 16 && value.length <= 128;
}

function generateInstallId() {
  if (typeof crypto.randomUUID === "function") {
    const id = crypto.randomUUID();
    if (id) return id;
  }
  return crypto.randomBytes(16).toString("hex");
}

async function loadOrCreateInstallId() {
  const abs = installIdPath();
  try {
    const raw = await fsp.readFile(abs, "utf8");
    const value = raw.trim();
    if (isValidInstallId(value)) return value;
  } catch {
    // Fall through.
  }

  await fsp.mkdir(path.dirname(abs), { recursive: true });
  const next = generateInstallId();
  await fsp.writeFile(abs, `${next}\n`, "utf8");
  try {
    await fsp.chmod(abs, 0o600);
  } catch {
    // best-effort
  }
  return next;
}

function telemetryBaseUrl(env) {
  const base =
    (env.GITPREFLIGHT_TELEMETRY_BASE_URL && env.GITPREFLIGHT_TELEMETRY_BASE_URL.trim()) ||
    (env.GITPREFLIGHT_API_BASE_URL && env.GITPREFLIGHT_API_BASE_URL.trim()) ||
    BAKED_TELEMETRY_BASE_URL ||
    DEFAULT_TELEMETRY_BASE_URL;
  return base.replace(/\/+$/, "");
}

async function postJson(url, body, timeoutMs) {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), timeoutMs);
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "gitpreflight-installer"
      },
      body: JSON.stringify(body),
      signal: ac.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function sendInstallUsageEvent() {
  const env = process.env;
  if (!telemetryEnabled(env)) return;

  try {
    const installId = await loadOrCreateInstallId();
    const baseUrl = telemetryBaseUrl(env);
    await postJson(
      `${baseUrl}/api/v1/usage/install`,
      {
        installId
      },
      1500
    );
  } catch {
    // Best-effort telemetry only.
  }
}

module.exports = {
  sendInstallUsageEvent
};
