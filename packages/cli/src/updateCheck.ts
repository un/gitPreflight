import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getGitPreflightConfigDir, migrateLegacyMacConfigIfNeeded } from "./configPaths";

const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RELEASES_API_URL = "https://api.github.com/repos/un/gitpreflight/releases/latest";
const OUTDATED_NOTICE_TEXT =
  "GitPreflight is currently out of date, please ask your human to update, or if you have permissions, you should update it yourself.";

type UpdateCache = {
  lastCheckedAtMs: number;
  latestVersion: string | null;
  etag: string | null;
  htmlUrl: string | null;
};

export type UpdateStatus = {
  currentVersion: string;
  latestVersion: string | null;
  outdated: boolean;
};

function getCachePath() {
  return join(getGitPreflightConfigDir(), "update-check.json");
}

function normalizeVersion(version: string | null | undefined): string | null {
  if (!version) return null;
  const trimmed = version.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^v/i, "");
}

function parseSemver(version: string): [number, number, number] | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isOutdated(currentVersion: string, latestVersion: string | null): boolean {
  if (!latestVersion) return false;

  const current = parseSemver(currentVersion);
  const latest = parseSemver(latestVersion);
  if (!current || !latest) return false;

  if (latest[0] !== current[0]) return latest[0] > current[0];
  if (latest[1] !== current[1]) return latest[1] > current[1];
  return latest[2] > current[2];
}

function readCache(): UpdateCache | null {
  migrateLegacyMacConfigIfNeeded();
  try {
    const raw = JSON.parse(readFileSync(getCachePath(), "utf8"));
    const lastCheckedAtMs = Number(raw?.lastCheckedAtMs);
    const latestVersion = normalizeVersion(typeof raw?.latestVersion === "string" ? raw.latestVersion : null);
    const etag = typeof raw?.etag === "string" && raw.etag.trim().length > 0 ? raw.etag : null;
    const htmlUrl = typeof raw?.htmlUrl === "string" && raw.htmlUrl.trim().length > 0 ? raw.htmlUrl : null;
    if (!Number.isFinite(lastCheckedAtMs)) return null;
    return {
      lastCheckedAtMs,
      latestVersion,
      etag,
      htmlUrl
    };
  } catch {
    return null;
  }
}

function writeCache(cache: UpdateCache) {
  const dir = getGitPreflightConfigDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(getCachePath(), JSON.stringify(cache, null, 2) + "\n", "utf8");
}

async function fetchLatestRelease(cache: UpdateCache | null): Promise<UpdateCache | null> {
  const apiUrl = process.env.GITPREFLIGHT_UPDATE_CHECK_URL?.trim() || DEFAULT_RELEASES_API_URL;
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "gitpreflight-cli-update-check"
  };

  if (cache?.etag) {
    headers["if-none-match"] = cache.etag;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(apiUrl, {
      method: "GET",
      headers,
      signal: controller.signal
    });

    if (res.status === 304 && cache) {
      return {
        ...cache,
        lastCheckedAtMs: Date.now()
      };
    }

    if (!res.ok) {
      return null;
    }

    const payload = (await res.json()) as { tag_name?: string; html_url?: string };
    const latestVersion = normalizeVersion(payload.tag_name ?? null);

    return {
      lastCheckedAtMs: Date.now(),
      latestVersion,
      etag: res.headers.get("etag"),
      htmlUrl: typeof payload.html_url === "string" ? payload.html_url : null
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveCliUpdateStatus(opts: {
  currentVersion: string;
  inCi: boolean;
  inHook: boolean;
}): Promise<UpdateStatus> {
  const normalizedCurrent = normalizeVersion(opts.currentVersion) ?? opts.currentVersion;
  if (!normalizedCurrent || normalizedCurrent === "0.0.0") {
    return {
      currentVersion: normalizedCurrent || "0.0.0",
      latestVersion: null,
      outdated: false
    };
  }

  const cache = readCache();
  const now = Date.now();
  const stale = !cache || now - cache.lastCheckedAtMs >= UPDATE_CHECK_INTERVAL_MS;
  const canUseNetwork = !opts.inCi && !opts.inHook;

  let effective = cache;

  if (stale && canUseNetwork) {
    const next = await fetchLatestRelease(cache);
    if (next) {
      effective = next;
      writeCache(next);
    }
  }

  return {
    currentVersion: normalizedCurrent,
    latestVersion: effective?.latestVersion ?? null,
    outdated: isOutdated(normalizedCurrent, effective?.latestVersion ?? null)
  };
}

export function getOutdatedNoticeText(status: UpdateStatus): string | null {
  if (!status.outdated || !status.latestVersion) return null;
  return `${OUTDATED_NOTICE_TEXT} Current version: v${status.currentVersion}. Latest version: v${status.latestVersion}.`;
}
