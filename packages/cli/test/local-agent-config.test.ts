import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDefaultLocalAgentCommand, getLocalAgentConfig, saveLocalAgentConfig } from "../src/cliConfig";
import { probeLocalAgentCommand, runLocalAgentMarkdownReview } from "../src/localAgent";

let prevXdg: string | undefined;
let tempXdg = "";
let prevPath: string | undefined;
let prevOpenCode: string | undefined;
let prevOpenCodeClient: string | undefined;
let prevOpenCodeServerUser: string | undefined;
let prevOpenCodeServerPassword: string | undefined;
let prevOpenCodePermission: string | undefined;
let prevOpenCodeTestFlag: string | undefined;

beforeEach(() => {
  prevXdg = process.env.XDG_CONFIG_HOME;
  prevPath = process.env.PATH;
  prevOpenCode = process.env.OPENCODE;
  prevOpenCodeClient = process.env.OPENCODE_CLIENT;
  prevOpenCodeServerUser = process.env.OPENCODE_SERVER_USERNAME;
  prevOpenCodeServerPassword = process.env.OPENCODE_SERVER_PASSWORD;
  prevOpenCodePermission = process.env.OPENCODE_PERMISSION;
  prevOpenCodeTestFlag = process.env.OPENCODE_GITPREFLIGHT_TEST;
  tempXdg = mkdtempSync(join(tmpdir(), "gitpreflight-local-agent-"));
  process.env.XDG_CONFIG_HOME = tempXdg;
});

afterEach(() => {
  if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = prevXdg;

  if (prevPath === undefined) delete process.env.PATH;
  else process.env.PATH = prevPath;

  if (prevOpenCode === undefined) delete process.env.OPENCODE;
  else process.env.OPENCODE = prevOpenCode;

  if (prevOpenCodeClient === undefined) delete process.env.OPENCODE_CLIENT;
  else process.env.OPENCODE_CLIENT = prevOpenCodeClient;

  if (prevOpenCodeServerUser === undefined) delete process.env.OPENCODE_SERVER_USERNAME;
  else process.env.OPENCODE_SERVER_USERNAME = prevOpenCodeServerUser;

  if (prevOpenCodeServerPassword === undefined) delete process.env.OPENCODE_SERVER_PASSWORD;
  else process.env.OPENCODE_SERVER_PASSWORD = prevOpenCodeServerPassword;

  if (prevOpenCodePermission === undefined) delete process.env.OPENCODE_PERMISSION;
  else process.env.OPENCODE_PERMISSION = prevOpenCodePermission;

  if (prevOpenCodeTestFlag === undefined) delete process.env.OPENCODE_GITPREFLIGHT_TEST;
  else process.env.OPENCODE_GITPREFLIGHT_TEST = prevOpenCodeTestFlag;

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

  it("fails when command writes error output to stderr", () => {
    const result = probeLocalAgentCommand({
      command: `node -e "process.stderr.write('Error: bad things happened\\n'); process.exit(0)"`,
      cwd: process.cwd(),
      timeoutMs: 5_000
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.reason).toBe("error_output");
  });

  it("strips session OPENCODE vars and forces non-interactive permissions", () => {
    const binDir = mkdtempSync(join(tmpdir(), "gitpreflight-opencode-bin-"));
    const opencodePath = join(binDir, "opencode");
    writeFileSync(
      opencodePath,
      [
        "#!/usr/bin/env node",
        "const blocked = ['OPENCODE','OPENCODE_CLIENT','OPENCODE_SERVER_URL','OPENCODE_SERVER_SESSION','OPENCODE_SERVER_USERNAME','OPENCODE_SERVER_PASSWORD'];",
        "const bad = blocked.find((key) => process.env[key]);",
        "if (bad) { console.error('bad-env:' + bad); process.exit(9); }",
        "if (process.env.OPENCODE_GITPREFLIGHT_TEST !== 'present') { console.error('missing-custom-env'); process.exit(12); }",
        "try {",
        "  const permission = JSON.parse(process.env.OPENCODE_PERMISSION || '{}');",
        "  if (permission.question !== 'deny') {",
        "    console.error('bad-permission');",
        "    process.exit(10);",
        "  }",
        "} catch {",
        "  console.error('bad-permission-json');",
        "  process.exit(11);",
        "}",
        "process.stdout.write('alive\\n');"
      ].join("\n") + "\n",
      "utf8"
    );
    chmodSync(opencodePath, 0o755);

    process.env.PATH = `${binDir}:${process.env.PATH ?? ""}`;
    process.env.OPENCODE = "1";
    process.env.OPENCODE_CLIENT = "desktop";
    process.env.OPENCODE_SERVER_URL = "http://127.0.0.1:1234";
    process.env.OPENCODE_SERVER_SESSION = "session-1";
    process.env.OPENCODE_SERVER_USERNAME = "user";
    process.env.OPENCODE_SERVER_PASSWORD = "pass";
    process.env.OPENCODE_GITPREFLIGHT_TEST = "present";
    delete process.env.OPENCODE_PERMISSION;

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

describe("local-agent markdown review", () => {
  it("accepts valid contract from stderr when stdout is empty", () => {
    const markdown = [
      "# GitPreflight Review",
      "",
      "Result: PASS",
      "Counts: note=0 minor=0 major=0",
      "",
      "## Findings",
      "",
      "(none)",
      ""
    ].join("\\n");

    const script = `node -e \"process.stderr.write('> model\\n${markdown.replaceAll("\n", "\\\\n")}'); process.exit(0)\"`;

    const result = runLocalAgentMarkdownReview({
      command: script,
      cwd: process.cwd(),
      timeoutMs: 5_000,
      prompt: "review"
    });

    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.status).toBe("PASS");
      expect(result.markdown).toContain("# GitPreflight Review");
    }
  });

  it("surfaces stderr error output when markdown contract is missing", () => {
    const result = runLocalAgentMarkdownReview({
      command: `node -e \"process.stderr.write('Error: sdk exploded\\n'); process.exit(0)\"`,
      cwd: process.cwd(),
      timeoutMs: 5_000,
      prompt: "review"
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.errorMessage).toContain("Command failed: Error: sdk exploded");
    }
  });

  it("falls back to discovered OpenCode model when default run fails", () => {
    const binDir = mkdtempSync(join(tmpdir(), "gitpreflight-opencode-fallback-bin-"));
    const opencodePath = join(binDir, "opencode");
    writeFileSync(
      opencodePath,
      [
        "#!/usr/bin/env node",
        "const args = process.argv.slice(2);",
        "if (args[0] === 'models') {",
        "  process.stdout.write('opencode/mock-good\\nopenai/mock-bad\\n');",
        "  process.exit(0);",
        "}",
        "if (args[0] !== 'run') process.exit(2);",
        "const idx = args.findIndex((v) => v === '--model' || v === '-m');",
        "const model = idx >= 0 ? args[idx + 1] : '';",
        "if (!model) {",
        "  process.stderr.write('Error: TypeError: sdk.responses is not a function\\n');",
        "  process.exit(0);",
        "}",
        "if (model !== 'opencode/mock-good') {",
        "  process.stderr.write('Error: unsupported model\\n');",
        "  process.exit(0);",
        "}",
        "process.stdout.write('# GitPreflight Review\\n\\nResult: PASS\\nCounts: note=0 minor=0 major=0\\n\\n## Findings\\n\\n(none)\\n');"
      ].join("\n") + "\n",
      "utf8"
    );
    chmodSync(opencodePath, 0o755);

    process.env.PATH = `${binDir}:${process.env.PATH ?? ""}`;

    const result = runLocalAgentMarkdownReview({
      command: "opencode run",
      cwd: process.cwd(),
      timeoutMs: 5_000,
      prompt: "review"
    });

    expect(result.ok).toBeTrue();
    if (result.ok) expect(result.status).toBe("PASS");

    rmSync(binDir, { recursive: true, force: true });
  });
});
