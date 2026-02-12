import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { isAuthenticated } from "@/lib/auth-server";
import { cn } from "@/lib/utils";
import styles from "./marketing.module.css";

const MARKDOWN_CONTRACT_EXCERPT = [
  "# GitPreflight Review",
  "",
  "Result: PASS",
  "Counts: note=0 minor=0 major=0",
  "",
  "## Findings",
  "",
  "### path/to/file.ts",
  "",
  "#### <short title>",
  "Path: path/to/file.ts",
  "Line: 42",
  "Severity: minor",
  "Agreement: 2/3",
  "",
  "<explanation paragraphs>",
  "",
  "```suggestion",
  "<replacement code>",
  "```",
].join("\n");

export default async function Home() {
  const ok = await isAuthenticated();
  const primaryHref = ok ? "/dashboard" : "/sign-in";

  return (
    <div className={cn("flex flex-col gap-10", styles.reveal)}>
      <section aria-label="Hero" className="pt-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Catch PR issues on git commit before your PR exists.</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          GitPreflight runs PR-style review checks automatically on <code>git commit</code> and optional <code>git push</code>.
        </p>
        <p className="mt-3 text-sm text-foreground">
          It reviews <code>git diff --cached</code> and sends actionable findings straight back into your coding agent so fixes happen
          before code leaves your branch.
        </p>
        <p className="mt-3 text-sm text-foreground">
          SaaS mode works out of the box. For local-agent mode, run <code>gitpreflight setup local-agent</code> once and GitPreflight
          stores command config in <code>~/.config/gitpreflight/config.json</code>.
        </p>
        <p className="mt-3 text-sm text-foreground">No more copying review comments from PR threads back into your agent.</p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link
            href={primaryHref}
            className={cn(buttonVariants({ variant: "default" }), "rounded-md shadow-none")}
          >
            {ok ? "Open dashboard" : "Install and review before commit"}
          </Link>
          <Link
            href="/#how-it-works"
            className={cn(buttonVariants({ variant: "outline" }), "rounded-md border-dashed bg-background/60 shadow-none")}
          >
            See the agent feedback loop
          </Link>
        </div>

        <div className="mt-6 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">How it works</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
            <li>You run <code>git commit</code> (or <code>git push</code>).</li>
            <li>GitPreflight runs PR-style checks before the command finishes.</li>
            <li>Findings are sent to your active agent session for immediate fixes.</li>
          </ol>
        </div>

        <div className="mt-6 rounded-lg border bg-card">
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">Install</div>
          <pre className="overflow-x-auto px-3 py-2 text-xs leading-5">
            <code>
              {`# npm\nnpm i -g gitpreflight\n\n# curl\ncurl -fsSL https://gitpreflight.ai/install | bash\n\n# setup\ngitpreflight auth login\ngitpreflight install\ngitpreflight setup local-agent\n\n# run\ngitpreflight review --staged --local-agent`}
            </code>
          </pre>
        </div>
      </section>

      <hr className="border-border" />

      <section id="problem" className="scroll-mt-24">
        <h2 className="text-base font-semibold">Problem</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Most teams get review feedback too late: after push, inside PR threads, and outside the coding loop.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
          <li>PR review happens after push, when the diff is already public and the context has shifted.</li>
          <li>Agents and bots dump feedback into PR threads, not into the codebase.</li>
          <li>The result is noise: long comment chains, repeated nits, and low-signal review for humans.</li>
          <li>Fix loops get slower: push -&gt; bot feedback -&gt; agent patch -&gt; more feedback -&gt; repeat.</li>
          <li>By the time a human reviews, they are reading the aftermath instead of the intent.</li>
        </ul>
      </section>

      <section id="before-after" className="scroll-mt-24 pt-2" aria-label="Before versus after">
        <h2 className="text-base font-semibold">Before vs After</h2>
        <p className="mt-2 text-sm text-muted-foreground">Same agent. Different loop. One creates PR noise, the other ships clean intent.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold">Before: chase the white rabbit</h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
              <li>Push first, review later.</li>
              <li>Feedback lands in PR comments after context is gone.</li>
              <li>You manually copy review text into your agent and wait for another patch.</li>
              <li>The PR becomes a debugging transcript.</li>
            </ul>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold">After: closed loop before push</h3>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
              <li>Review starts on <code>git commit</code> and optional <code>git push</code>.</li>
              <li>PR-style findings are delivered directly into your agent workflow.</li>
              <li>Commit-time review returns stable Markdown with actionable <code>suggestion</code> blocks.</li>
              <li>Your local loop runs PASS/FAIL/UNCHECKED, then you push after PASS.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="solution" aria-label="Solution" className="pt-2 scroll-mt-24">
        <h2 className="text-base font-semibold">Solution</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          GitPreflight runs the same style of review before commit/push completes, then routes findings straight back to your agent.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
          <li>Runs in git hooks on <code>git commit</code> with optional pre-push checks.</li>
          <li>Reviews only the staged diff (<code>git diff --cached</code>) so scope stays tight.</li>
          <li>Returns stable Markdown with actionable <code>suggestion</code> blocks.</li>
          <li>Use explicit loop semantics: FAIL blocks, UNCHECKED allows with local backlog, PASS is ready to push.</li>
          <li>Close the loop locally: your agent iterates to PASS, then humans review intent instead of cleanup.</li>
        </ul>
      </section>

      <section id="how-it-works" className="scroll-mt-24">
        <h2 className="text-base font-semibold">How it works</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A pre-commit and pre-push review protocol that keeps the full fix loop inside your agent.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
          <li>Stage changes and run <code>git commit</code> (with optional checks on <code>git push</code>).</li>
          <li>GitPreflight reviews <code>git diff --cached</code> and prints stable Markdown with Result: PASS, FAIL, or UNCHECKED.</li>
          <li>If FAIL, findings and <code>suggestion</code> blocks are routed into your active agent session.</li>
          <li>Your agent patches code, you restage, and rerun commit/push checks until PASS.</li>
          <li>Only then do you open or update a PR, with cleaner intent and less thread noise.</li>
        </ol>
      </section>

      <section id="local-agent-setup" className="scroll-mt-24 pt-2" aria-label="Local-agent setup">
        <h2 className="text-base font-semibold">Local-agent setup</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Local-agent mode is configured once, then reused on every review run.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
          <li>Run <code>gitpreflight setup local-agent</code>.</li>
          <li>Choose your provider: <code>Codex</code>, <code>Claude</code>, or <code>OpenCode</code>.</li>
          <li>GitPreflight probes the selected command by sending <code>hi are you alive</code> to stdin.</li>
          <li>If probe passes (spawn ok + exit 0 + non-empty output), config is saved.</li>
          <li>Saved files: <code>~/.config/gitpreflight/config.json</code> and <code>config.schema.json</code>.</li>
        </ol>
        <div className="mt-4 rounded-lg border bg-card">
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">Provider defaults</div>
          <pre className="overflow-x-auto px-3 py-2 text-xs leading-5">
            <code>{`Codex    -> codex\nClaude   -> claude\nOpenCode -> opencode run`}</code>
          </pre>
        </div>
      </section>

      <section aria-label="Markdown contract" className="pt-2">
        <h2 className="text-base font-semibold">Markdown contract</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Output is stable by design so your agent can parse it, apply suggestions, and rerun.
        </p>
        <div className="mt-4 rounded-lg border bg-card">
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">Excerpt: packages/core/MARKDOWN_CONTRACT.md</div>
          <pre className="overflow-x-auto px-3 py-2 text-xs leading-5">
            <code>{MARKDOWN_CONTRACT_EXCERPT}</code>
          </pre>
        </div>
      </section>

      <section aria-label="Privacy" className="pt-2">
        <h2 className="text-base font-semibold">Privacy stance</h2>
        <p className="mt-2 text-sm text-muted-foreground">Short version: GitPreflight avoids storing customer repo source code at rest.</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
          <li>The server stores instruction file contents (by hash) when configured (e.g. `AGENTS.md`).</li>
          <li>The server stores review outputs and aggregated usage/statistics.</li>
          <li>The server does not store arbitrary repo files.</li>
        </ul>
      </section>

      <section id="pricing" className="scroll-mt-24">
        <h2 className="text-base font-semibold">Pricing</h2>
        <p className="mt-2 text-sm text-muted-foreground">Pick your daily commit budget. Keep commits small, PRs quiet.</p>

        <div className="mt-4 flex flex-col gap-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-baseline justify-between gap-4">
              <div className="text-sm font-semibold">LLM Dabbler</div>
              <div className="text-sm text-muted-foreground">$0</div>
            </div>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
              <li>69 commits/day</li>
              <li>Reviews up to 5 files per commit</li>
            </ul>
            <div className="mt-3 rounded-md border bg-background px-3 py-2 text-sm">
              <div className="text-xs text-muted-foreground">5-file cap semantics</div>
              <div className="mt-2">
                If a commit changes more than 5 files, GitPreflight reviews the first 5 files only (unique staged paths sorted
                lexicographically). The commit is still allowed, and the report includes a note listing skipped paths plus an
                upgrade CTA.
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-baseline justify-between gap-4">
              <div className="text-sm font-semibold">Agent Wrangler</div>
              <div className="text-sm text-muted-foreground">$30/month</div>
            </div>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
              <li>420 commits/day</li>
            </ul>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-baseline justify-between gap-4">
              <div className="text-sm font-semibold">AGI Observer</div>
              <div className="text-sm text-muted-foreground">$69.420/month</div>
            </div>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
              <li>1337 commits/day</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24">
        <h2 className="text-base font-semibold">FAQ</h2>
        <div className="mt-4 flex flex-col gap-6 text-sm">
          <div>
            <h3 className="font-semibold">Do you store my repo code?</h3>
            <p className="mt-2 text-muted-foreground">
              GitPreflight avoids storing customer repo source code at rest. The server stores instruction file contents (by hash)
              when configured (e.g. `AGENTS.md`), plus review outputs and aggregated usage/statistics. It does not store arbitrary
              repo files.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">What happens if GitPreflight is offline or times out?</h3>
            <p className="mt-2 text-muted-foreground">
              The commit is allowed. The commit is marked `UNCHECKED` locally under `.git/gitpreflight/`. The next run on the same
              branch is blocked until the backlog is cleared or explicitly bypassed.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">How do I bypass GitPreflight?</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>One-shot bypass: `gitpreflight skip-next --reason &quot;&lt;why&gt;&quot;`</li>
              <li>Universal bypass: `git commit --no-verify`</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold">How do I configure local-agent mode?</h3>
            <p className="mt-2 text-muted-foreground">
              Run <code>gitpreflight setup local-agent</code>, pick <code>Codex</code>, <code>Claude</code>, or <code>OpenCode</code>, and
              let GitPreflight probe the command. On success, config is saved to <code>~/.config/gitpreflight/config.json</code>.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">Is GitHub required?</h3>
            <p className="mt-2 text-muted-foreground">For now, yes. GitPreflight sign-in uses GitHub.</p>
          </div>

          <div>
            <h3 className="font-semibold">What does &quot;reviews up to 5 files&quot; mean on LLM Dabbler?</h3>
            <p className="mt-2 text-muted-foreground">
              If a commit changes more than 5 files, GitPreflight reviews the first 5 files only (unique staged paths sorted
              lexicographically). The commit is still allowed, and the report includes a note listing skipped paths plus an
              upgrade CTA.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
