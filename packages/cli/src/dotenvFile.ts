import { readFileSync } from "node:fs";
import { join } from "node:path";

function parseLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const noExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
  const eq = noExport.indexOf("=");
  if (eq === -1) return null;

  const key = noExport.slice(0, eq).trim();
  if (!key) return null;

  let value = noExport.slice(eq + 1).trim();

  // Strip inline comments for unquoted values.
  if (!(value.startsWith('"') || value.startsWith("'"))) {
    const hash = value.indexOf(" #");
    if (hash !== -1) value = value.slice(0, hash).trimEnd();
  }

  // Unquote simple quoted strings.
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

export function loadRepoEnv(repoRoot: string): Record<string, string> {
  const out: Record<string, string> = {};
  const candidates = [".env", ".env.local"];

  for (const f of candidates) {
    const abs = join(repoRoot, f);
    let txt: string;
    try {
      txt = readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    for (const line of txt.split("\n")) {
      const parsed = parseLine(line);
      if (!parsed) continue;
      out[parsed.key] = parsed.value;
    }
  }

  return out;
}
