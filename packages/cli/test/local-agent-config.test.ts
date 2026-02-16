import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDefaultLocalAgentCommand, getLocalAgentConfig, saveLocalAgentConfig } from "../src/cliConfig";
import { probeLocalAgentCommand } from "../src/localAgent";

let prevXdg: string | undefined;
let tempXdg = "";
let prevPath: string | undefined;
let prevOpenCodeServerUser: string | undefined;
let prevOpenCodeServerPassword: string | undefined;

beforeEach(() => {
  prevXdg = process.env.XDG_CONFIG_HOME;
  prevPath = process.env.PATH;
  prevOpenCodeServerUser = process.env.OPENCODE_SERVER_USERNAME;
  prevOpenCodeServerPassword = process.env.OPENCODE_SERVER_PASSWORD;
  tempXdg = mkdtempSync(join(tmpdir(), "gitpreflight-local-agent-"));
  process.env.XDG_CONFIG_HOME = tempXdg;
});

afterEach(() => {
  if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = prevXdg;

  if (prevPath === undefined) delete process.env.PATH;
  else process.env.PATH = prevPath;

  if (prevOpenCodeServerUser === undefined) delete process.env.OPENCODE_SERVER_USERNAME;
  else process.env.OPENCODE_SERVER_USERNAME = prevOpenCodeServerUser;

  if (prevOpenCodeServerPassword === undefined) delete process.env.OPENCODE_SERVER_PASSWORD;
  else process.env.OPENCODE_SERVER_PASSWORD = prevOpenCodeServerPassword;

  rmSync(tempXdg, { recursive: true, force: true });
});

describe("local-agent config", () => {
  it("saves and loads local-agent command from config file", () => {
    saveLocalAgentConfig({ provider: "opencode", command: "opencode run" });

    const loaded = getLocalAgentConfig();
    expect(loaded).toEqual({ provider: "opencode", command: "opencode run" });

    const raw = readFileSync(join(tempXdg, "gitpreflight", "config.json"), "utf8");
    expect(raw).toContain("\"localAgent\"");
    expect(raw).toContain("\"command\": \"opencode run\"");
  });

  it("maps provider defaults", () => {
    expect(getDefaultLocalAgentCommand("codex")).toBe("codex");
    expect(getDefaultLocalAgentCommand("claude")).toBe("claude");
    expect(getDefaultLocalAgentCommand("opencode")).toBe("opencode run");
  });
});

describe("local-agent probe", () => {
  it("passes when command exits zero and writes output", () => {
    const result = probeLocalAgentCommand({
      command: `node -e "process.stdin.on('data',()=>{}); process.stdout.write('alive\\n')"`,
      cwd: process.cwd(),
      timeoutMs: 5_000
    });
    expect(result.ok).toBeTrue();
  });

  it("fails when command writes no output", () => {
    const result = probeLocalAgentCommand({
      command: `node -e "process.stdin.on('data',()=>{}); process.exit(0)"`,
      cwd: process.cwd(),
      timeoutMs: 5_000
    });
    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.reason).toBe("empty_output");
  });

  it("strips OpenCode server session env vars for opencode command", () => {
    const binDir = mkdtempSync(join(tmpdir(), "gitpreflight-opencode-bin-"));
    const opencodePath = join(binDir, "opencode");
    writeFileSync(
      opencodePath,
      [
        "#!/usr/bin/env sh",
        "if [ -n \"$OPENCODE_SERVER_USERNAME\" ] || [ -n \"$OPENCODE_SERVER_PASSWORD\" ]; then",
        "  echo bad-env >&2",
        "  exit 9",
        "fi",
        "echo alive"
      ].join("\n") + "\n",
      "utf8"
    );
    chmodSync(opencodePath, 0o755);

    process.env.PATH = `${binDir}:${process.env.PATH ?? ""}`;
    process.env.OPENCODE_SERVER_USERNAME = "user";
    process.env.OPENCODE_SERVER_PASSWORD = "pass";

    const result = probeLocalAgentCommand({
      command: "opencode run",
      cwd: process.cwd(),
      timeoutMs: 5_000
    });

    expect(result.ok).toBeTrue();

    rmSync(binDir, { recursive: true, force: true });
  });

  it("preserves env vars for non-opencode commands", () => {
    process.env.OPENCODE_SERVER_USERNAME = "user";

    const result = probeLocalAgentCommand({
      command: `node -e \"if (process.env.OPENCODE_SERVER_USERNAME) process.stdout.write('alive\\n'); else process.exit(2)\"`,
      cwd: process.cwd(),
      timeoutMs: 5_000
    });

    expect(result.ok).toBeTrue();
  });
});
