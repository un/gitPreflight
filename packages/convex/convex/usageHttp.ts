import { httpAction } from "./_generated/server";

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";
const POSTHOG_TIMEOUT_MS = 3_000;

function getPosthogApiKey(): string {
  const key = process.env.POSTHOG_API_KEY?.trim() || process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!key) throw new Error("missing_posthog_api_key");
  return key;
}

function getPosthogHost(): string {
  const host = process.env.POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST;
  return host.replace(/\/+$/, "");
}

async function parseInstallId(request: Request): Promise<string | null> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return null;
  }

  if (!raw || typeof raw !== "object") return null;
  const installId = (raw as { installId?: unknown }).installId;
  if (typeof installId !== "string") return null;

  const trimmed = installId.trim();
  if (trimmed.length < 16 || trimmed.length > 128) return null;
  return trimmed;
}

async function capturePosthogUsageEvent(event: "usage/install" | "usage/review", installId: string): Promise<void> {
  const apiKey = getPosthogApiKey();
  const host = getPosthogHost();

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), POSTHOG_TIMEOUT_MS);

  try {
    const res = await fetch(`${host}/capture/`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: installId,
        properties: {
          installId,
          source: "gitpreflight"
        }
      }),
      signal: ac.signal
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`posthog_capture_failed:${res.status}:${body.slice(0, 256)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export const usageInstall = httpAction(async (_ctx, request) => {
  const installId = await parseInstallId(request);
  if (!installId) return Response.json({ error: "invalid_request" }, { status: 400 });

  try {
    await capturePosthogUsageEvent("usage/install", installId);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "usage_unavailable" }, { status: 503 });
  }
});

export const usageReview = httpAction(async (_ctx, request) => {
  const installId = await parseInstallId(request);
  if (!installId) return Response.json({ error: "invalid_request" }, { status: 400 });

  try {
    await capturePosthogUsageEvent("usage/review", installId);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "usage_unavailable" }, { status: 503 });
  }
});
