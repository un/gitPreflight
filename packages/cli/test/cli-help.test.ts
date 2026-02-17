import { describe, expect, it } from "bun:test";
import { runCli } from "../src/index";

describe("CLI help", () => {
  it("shows review usage", async () => {
    let out = "";
    const prevStdoutWrite = process.stdout.write.bind(process.stdout);
    (process.stdout.write as any) = ((chunk: any) => {
      out += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    try {
      const code = await runCli(["review", "--help"]);
      expect(code).toBe(0);
      expect(out).toContain("Usage: gitpreflight review (--staged|--push)");
    } finally {
      (process.stdout.write as any) = prevStdoutWrite;
    }
  });
});
