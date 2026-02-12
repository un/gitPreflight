import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import styles from "./marketing.module.css";

const MARKDOWN_CONTRACT_EXCERPT = [
  "# GitPreflight Review",
  "",
  "Result: FAIL",
  "Counts: note=1 minor=1 major=0",
  "",
  "## Findings",
  "",
  "### src/loop.ts",
  "",
  "#### Retry logic misses backoff",
  "Path: src/loop.ts",
  "Line: 42",
  "Severity: minor",
  "Agreement: 2/3",
  "",
  "Use exponential backoff to avoid tight failure loops.",
  "",
  "```suggestion",
  "await wait(Math.min(5000, 250 * 2 ** attempt));",
  "```",
].join("\n");

export default function Home() {

  return (
    <div className={cn("flex flex-col gap-10", styles.reveal)}>
      <section aria-label="Hero" className="pt-2">
        <p className={styles.eyebrow}>Local-first PR feedback</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Run PR feedback on every commit. Open clean PRs only.
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          GitPreflight reviews your staged diff during <code>git commit</code>, routes findings directly into your coding agent, and
          keeps the full fix loop local before any PR exists.
        </p>
        <p className="mt-3 text-sm text-foreground">
          No copy/paste. No manual prompting. No waiting for PR comments. Agent-to-agent feedback runs in the same loop until
          result is PASS.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link href="/#install" className={cn(buttonVariants({ variant: "default" }), "rounded-md shadow-none")}>
            Install the CLI
          </Link>
          <Link
            href="/#loop"
            className={cn(buttonVariants({ variant: "outline" }), "rounded-md border-dashed bg-background/60 shadow-none")}
          >
            See the autonomous loop
          </Link>
        </div>

        <div className="mt-6 rounded-lg border bg-card">
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">Quick start</div>
          <pre className="overflow-x-auto px-3 py-2 text-xs leading-5">
            <code>{`npm i -g gitpreflight\ngitpreflight install\ngitpreflight setup local-agent\n\n# then work as usual\ngit add -A\ngit commit -m "feat: improve retry loop"`}</code>
          </pre>
        </div>
      </section>

      <hr className="border-border" />

      <section id="loop" className="scroll-mt-24">
        <h2 className="text-base font-semibold">The loop, before PR</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The review cycle happens at commit time, so humans read intent in the PR instead of cleanup threads.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
          <li>You stage changes and run <code>git commit</code>.</li>
          <li>GitPreflight reviews <code>git diff --cached</code> with PR-style checks.</li>
          <li>Findings are injected into your active agent session with actionable suggestions.</li>
          <li>Your agent patches code, restages, and reruns until PASS.</li>
          <li>Only then do you open a PR with less noise and fewer review rounds.</li>
        </ol>
      </section>

      <section id="autonomous" className="scroll-mt-24 pt-2" aria-label="Autonomous local workflow">
        <h2 className="text-base font-semibold">Fully autonomous by default</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Designed for local agent workflows that should run without extra user prompts.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold">Without GitPreflight</h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
              <li>Feedback arrives after push, inside PR comments.</li>
              <li>You manually shuttle comments back into your agent.</li>
              <li>Each fix adds more thread noise and review churn.</li>
              <li>PRs read like a transcript instead of a clean change.</li>
            </ul>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold">With GitPreflight</h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
              <li>Review starts on <code>git commit</code> in your local loop.</li>
              <li>Agent-to-agent feedback arrives before any PR is created.</li>
              <li>Structured findings include ready-to-apply <code>suggestion</code> blocks.</li>
              <li>You push only after PASS and open cleaner PRs.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="agent-feedback" aria-label="Agent feedback protocol" className="pt-2 scroll-mt-24">
        <h2 className="text-base font-semibold">Agent feedback protocol</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Stable Markdown output makes autonomous parsing and patching predictable across runs.
        </p>
        <div className="mt-4 rounded-lg border bg-card">
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">Excerpt: MARKDOWN_CONTRACT</div>
          <pre className="overflow-x-auto px-3 py-2 text-xs leading-5">
            <code>{MARKDOWN_CONTRACT_EXCERPT}</code>
          </pre>
        </div>
      </section>

      <section id="install" className="scroll-mt-24 pt-2" aria-label="Install and setup">
        <h2 className="text-base font-semibold">Install for local development</h2>
        <p className="mt-2 text-sm text-muted-foreground">Set up once, then keep your agent loop hands-free on every commit.</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
          <li>Install and wire hooks with <code>gitpreflight install</code>.</li>
          <li>Run <code>gitpreflight setup local-agent</code> and select your CLI agent.</li>
          <li>GitPreflight probes the command and stores validated config locally.</li>
          <li>Commit as usual; feedback is routed automatically during the hook.</li>
        </ol>
        <div className="mt-4 rounded-lg border bg-card">
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">Saved local config</div>
          <pre className="overflow-x-auto px-3 py-2 text-xs leading-5">
            <code>{`~/.config/gitpreflight/config.json\n~/.config/gitpreflight/config.schema.json`}</code>
          </pre>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24">
        <h2 className="text-base font-semibold">FAQ</h2>
        <div className="mt-4 flex flex-col gap-6 text-sm">
          <div>
            <h3 className="font-semibold">How do I bypass GitPreflight?</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>One-shot bypass: `gitpreflight skip-next --reason &quot;&lt;why&gt;&quot;`</li>
              <li>Universal bypass: `git commit --no-verify`</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold">Does this require manual prompting every time?</h3>
            <p className="mt-2 text-muted-foreground">
              No. Once local-agent setup is complete, GitPreflight runs in the hook flow and routes findings automatically into your
              active agent loop.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">What makes PRs cleaner?</h3>
            <p className="mt-2 text-muted-foreground">
              The noisy fix rounds happen before PR creation. Reviewers see the intended change set instead of agent back-and-forth.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">What if a review run times out?</h3>
            <p className="mt-2 text-muted-foreground">
              The commit is marked <code>UNCHECKED</code> locally under <code>.git/gitpreflight/</code> and surfaced on the next run so
              the backlog stays visible.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
