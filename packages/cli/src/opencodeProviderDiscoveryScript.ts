export const OPENCODE_PROVIDER_DISCOVERY_SCRIPT = String.raw`
const { spawn } = require("node:child_process");
const http = require("node:http");

const timeoutMs = Number(process.env.GPF_DISCOVERY_TIMEOUT_MS || "12000");
const cwd = process.env.GPF_DISCOVERY_CWD || process.cwd();

let child;
let done = false;
let serverPort = null;

function finish(code, payload) {
  if (done) return;
  done = true;

  let flushed = false;
  const flushAndExit = () => {
    if (flushed) return;
    flushed = true;
    if (payload !== undefined) {
      process.stdout.write(typeof payload === "string" ? payload : JSON.stringify(payload));
    }
    process.exit(code);
  };

  if (!child || child.exitCode !== null) {
    flushAndExit();
    return;
  }

  child.once("exit", () => flushAndExit());
  try { child.kill("SIGTERM"); } catch {}

  setTimeout(() => {
    if (child && child.exitCode === null) {
      try { child.kill("SIGKILL"); } catch {}
      setTimeout(() => flushAndExit(), 120);
    }
  }, 500);
}

function parseListeningPort(chunk) {
  const m = chunk.match(/opencode server listening on http:\/\/127\.0\.0\.1:(\d+)/);
  return m ? Number(m[1]) : null;
}

function fetchProvider() {
  const req = http.get(
    {
      hostname: "127.0.0.1",
      port: serverPort,
      path: "/provider",
      timeout: Math.max(1000, timeoutMs - 500),
    },
    (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (part) => (raw += part));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          finish(1);
          return;
        }
        try {
          const parsed = JSON.parse(raw);
          const connected = Array.isArray(parsed?.connected)
            ? parsed.connected.filter((v) => typeof v === "string")
            : [];
          const defaults = parsed?.default && typeof parsed.default === "object" && !Array.isArray(parsed.default)
            ? Object.fromEntries(
                Object.entries(parsed.default).filter(
                  ([k, v]) => typeof k === "string" && typeof v === "string"
                )
              )
            : {};
          finish(0, { connected, defaults });
        } catch {
          finish(1);
        }
      });
    }
  );

  req.on("error", () => finish(1));
  req.on("timeout", () => {
    try { req.destroy(); } catch {}
    finish(1);
  });
}

const childEnv = { ...process.env };
delete childEnv.OPENCODE;
delete childEnv.OPENCODE_CLIENT;
delete childEnv.OPENCODE_SERVER_URL;
delete childEnv.OPENCODE_SERVER_SESSION;
delete childEnv.OPENCODE_SERVER_USERNAME;
delete childEnv.OPENCODE_SERVER_PASSWORD;

child = spawn("opencode", ["serve", "--hostname", "127.0.0.1", "--port", "0"], {
  cwd,
  env: childEnv,
  stdio: ["ignore", "pipe", "pipe"],
});

child.on("error", () => finish(1));

const onData = (buf) => {
  if (done || serverPort !== null) return;
  const txt = buf.toString();
  const parsedPort = parseListeningPort(txt);
  if (parsedPort !== null) {
    serverPort = parsedPort;
    fetchProvider();
  }
};

child.stdout.on("data", onData);
child.stderr.on("data", onData);

setTimeout(() => finish(1), timeoutMs).unref();
`;
