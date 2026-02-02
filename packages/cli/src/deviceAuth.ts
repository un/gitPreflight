import { saveToken } from "./token";

export type DeviceStartResponse = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  intervalMs: number;
  expiresAtMs: number;
};

async function postJson(baseUrl: string, path: string, body: unknown) {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  return { res, text };
}

export async function deviceAuthLogin(apiBaseUrl: string) {
  const { res: startRes, text: startText } = await postJson(apiBaseUrl, "/api/v1/auth/device/start", {});
  if (!startRes.ok) {
    throw new Error(`Device auth start failed (${startRes.status}): ${startText}`);
  }

  const started = JSON.parse(startText) as DeviceStartResponse;
  const verificationUrl = started.verificationUri.startsWith("http")
    ? started.verificationUri
    : `${apiBaseUrl.replace(/\/$/, "")}${started.verificationUri}`;

  process.stdout.write(`Open: ${verificationUrl}\n`);
  process.stdout.write(`Enter code: ${started.userCode}\n`);

  const deadline = started.expiresAtMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, started.intervalMs));

    const { res, text } = await postJson(apiBaseUrl, "/api/v1/auth/device/complete", {
      deviceCode: started.deviceCode
    });

    if (res.status === 428) continue;
    if (res.status === 410) throw new Error("Device code expired");

    if (!res.ok) {
      continue;
    }

    const data = JSON.parse(text) as { token: string };
    if (!data.token) throw new Error("No token returned");
    saveToken(data.token);
    return;
  }

  throw new Error("Device auth timed out");
}
