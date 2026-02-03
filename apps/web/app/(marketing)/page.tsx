import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { isAuthenticated } from "@/lib/auth-server";

export default async function Home() {
  const ok = await isAuthenticated();
  const primaryHref = ok ? "/dashboard" : "/sign-in";
  const primaryLabel = ok ? "Dashboard" : "Sign in";

  return (
    <div className="flex flex-col gap-10">
      <section aria-label="Hero" className="pt-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Shipstamp</h1>
        <p className="mt-4 text-sm text-muted-foreground">Clean PRs by default. Fix issues at commit time.</p>
        <p className="mt-3 text-sm text-foreground">
          Shipstamp runs staged-only pre-commit reviews and returns stable, actionable Markdown your agent can apply before you push.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link href={primaryHref} className={buttonVariants({ variant: "default" })}>
            {primaryLabel}
          </Link>
          <Link href="/#pricing" className={buttonVariants({ variant: "outline" })}>
            View pricing
          </Link>
        </div>

        <div className="mt-6 rounded-lg border bg-card">
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">Install</div>
          <pre className="overflow-x-auto px-3 py-2 text-xs leading-5">
            <code>
              {`# npm\nnpm i -g shipstamp\nshipstamp --help\n\n# curl\ncurl -fsSL https://shipstamp.ai/install | bash\nshipstamp --help`}
            </code>
          </pre>
        </div>
      </section>

      <hr className="border-border" />

      <section id="problem" className="scroll-mt-24">
        <h2 className="text-base font-semibold">Problem</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          If you have ever opened a PR and immediately regretted the comment thread you are about to create.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
          <li>PR review happens after push, when the diff is already public and the context has shifted.</li>
          <li>Agents and bots dump feedback into PR threads, not into the codebase.</li>
          <li>The result is noise: long comment chains, repeated nits, and low-signal review for humans.</li>
          <li>Fix loops get slower: push -&gt; bot feedback -&gt; agent patch -&gt; more feedback -&gt; repeat.</li>
          <li>By the time a human reviews, they are reading the aftermath instead of the intent.</li>
        </ul>
      </section>

      <section id="how-it-works" className="scroll-mt-24">
        <h2 className="text-base font-semibold">How it works</h2>
        <p className="mt-2 text-sm text-muted-foreground">Landing page content is coming next.</p>
      </section>

      <section id="pricing" className="scroll-mt-24">
        <h2 className="text-base font-semibold">Pricing</h2>
        <p className="mt-2 text-sm text-muted-foreground">Landing page content is coming next.</p>
      </section>

      <section id="faq" className="scroll-mt-24">
        <h2 className="text-base font-semibold">FAQ</h2>
        <p className="mt-2 text-sm text-muted-foreground">Landing page content is coming next.</p>
      </section>
    </div>
  );
}
