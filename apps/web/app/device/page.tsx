"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export default function DevicePage() {
  const session = authClient.useSession();
  const approve = useMutation(api.deviceAuth.approve);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const normalized = useMemo(() => code.trim().toUpperCase(), [code]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Device Login</CardTitle>
            <CardDescription>Enter the code shown in your terminal to authorize the CLI.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!session.data ? (
              <>
                <Button
                  onClick={async () => {
                    await authClient.signIn.social({
                      provider: "github",
                      callbackURL: "/device"
                    });
                  }}
                >
                  Sign in with GitHub
                </Button>
                <Link href="/" className={buttonVariants({ variant: "ghost" })}>
                  Back
                </Link>
              </>
            ) : (
              <>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ABCD-EFGH"
                  autoCapitalize="characters"
                />
                <Button
                  onClick={async () => {
                    setStatus(null);
                    try {
                      await approve({ userCode: normalized });
                      setStatus("Approved. You can return to the CLI.");
                    } catch {
                      setStatus("Failed to approve code.");
                    }
                  }}
                >
                  Approve
                </Button>
                {status ? <div className="text-sm text-muted-foreground">{status}</div> : null}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
