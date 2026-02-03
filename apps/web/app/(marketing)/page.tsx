import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConvexHealth } from "../ConvexHealth";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Shipstamp</CardTitle>
          <CardDescription>Staged-only pre-commit reviews for AI agents.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground">
            This page renders coss ui components installed via the shadcn CLI.
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/sign-in" className={buttonVariants({ variant: "default" })}>
              Sign in
            </Link>
            <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
              Dashboard
            </Link>
          </div>
        </CardContent>
      </Card>

      <ConvexHealth />

      <hr className="border-border" />

      <section id="problem" className="scroll-mt-24">
        <h2 className="text-base font-semibold">Problem</h2>
        <p className="mt-2 text-sm text-muted-foreground">Landing page content is coming next.</p>
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
