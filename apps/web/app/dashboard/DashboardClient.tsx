"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { api } from "../../../../convex/_generated/api";

export function DashboardClient() {
  const identity = useQuery(api.auth.getCurrentUser);
  const session = authClient.useSession();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold">Dashboard</div>
            <div className="text-sm text-muted-foreground">Authenticated area</div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      window.location.href = "/";
                    }
                  }
                });
              }}
            >
              Sign out
            </Button>
            <Link href="/" className={buttonVariants({ variant: "ghost" })}>
              Home
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>Client session (Better Auth)</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md bg-muted px-3 py-2 text-xs">
              {JSON.stringify(session.data ?? null, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>Server identity (Convex)</CardDescription>
          </CardHeader>
          <CardContent>
            {identity === undefined ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : (
              <pre className="overflow-auto rounded-md bg-muted px-3 py-2 text-xs">
                {JSON.stringify(identity, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
