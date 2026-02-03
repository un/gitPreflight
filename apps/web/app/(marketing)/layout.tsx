import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { isAuthenticated } from "@/lib/auth-server";

export default async function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ok = await isAuthenticated();

  const ctaHref = ok ? "/dashboard" : "/sign-in";
  const ctaLabel = ok ? "Dashboard" : "Sign in";

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:bg-background focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[78ch] items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            shipstamp
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={ctaHref}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </header>

      <main id="content" className="mx-auto w-full max-w-[78ch] px-6 py-10">
        {children}
      </main>
    </div>
  );
}
