import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import path from "node:path";

// Load env from the monorepo root (../../.env.local).
// Next.js only auto-loads env files from the app directory.
const repoRoot = path.resolve(__dirname, "../..");

function loadEnvFile(absPath: string) {
  let txt: string;
  try {
    txt = readFileSync(absPath, "utf8");
  } catch {
    return;
  }

  for (const line of txt.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const noExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const eq = noExport.indexOf("=");
    if (eq === -1) continue;

    const key = noExport.slice(0, eq).trim();
    if (!key) continue;
    if (process.env[key] != null) continue;

    let value = noExport.slice(eq + 1).trim();

    if (!(value.startsWith('"') || value.startsWith("'"))) {
      const hash = value.indexOf(" #");
      if (hash !== -1) value = value.slice(0, hash).trimEnd();
    }

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(path.join(repoRoot, ".env"));
loadEnvFile(path.join(repoRoot, ".env.local"));

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true
  }
};

export default nextConfig;
