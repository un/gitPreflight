"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

type SignInClientProps = {
  alreadySignedIn: boolean;
};

export default function SignInClient({ alreadySignedIn }: SignInClientProps) {
  const [busy, setBusy] = useState(false);
  const [waitlistState, setWaitlistState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (!alreadySignedIn) return;
    let canceled = false;
    setWaitlistState("saving");
    fetch("/api/v1/emails/welcome", { method: "POST" })
      .then((res) => {
        if (canceled) return;
        setWaitlistState(res.ok ? "saved" : "error");
      })
      .catch(() => {
        if (canceled) return;
        setWaitlistState("error");
      });

    return () => {
      canceled = true;
    };
  }, [alreadySignedIn]);

  if (alreadySignedIn) {
    return (
      <div className="mx-auto w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>You are on the launch list</CardTitle>
            <CardDescription>
              Thanks for signing up. Hosted GitPreflight is coming soon, and we will email you as soon as full access is live.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="text-sm text-muted-foreground">
              {waitlistState === "saving" && "Saving your signup..."}
              {waitlistState === "saved" && "Signup saved. You are on the email list."}
              {waitlistState === "error" && "We could not confirm the email list right now, but your account is ready."}
            </div>
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Back to home
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Sign up</CardTitle>
          <CardDescription>Sign in with GitHub to join the launch list. We will email you when hosted GitPreflight is live.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await authClient.signIn.social({
                provider: "github",
                callbackURL: "/sign-in"
              });
            }}
          >
            Continue with GitHub
          </Button>
          <Link href="/" className={buttonVariants({ variant: "ghost" })}>
            Back
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
