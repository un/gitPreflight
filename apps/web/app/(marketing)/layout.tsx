import type { Metadata } from "next";
import Link from "next/link";

const GITHUB_REPO_URL = "https://github.com/un/gitpreflight";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://gitpreflight.ai";
const MARKETING_TITLE = "GitPreflight | Autonomous PR feedback for local CLI workflows";
const MARKETING_DESCRIPTION =
  "Run PR-style reviews during git commit, route findings directly into your local coding agent, and open clean pull requests after autonomous fix loops pass.";
const OG_IMAGE_ALT = "GitPreflight commit and push review loop preview image";
const OG_IMAGE_URL = `${SITE_URL}/og.png`;
const NOISE_DATA_URL =
  "data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A//www.w3.org/2000/svg'%20width%3D'128'%20height%3D'128'%3E%3Cfilter%20id%3D'n'%3E%3CfeTurbulence%20type%3D'fractalNoise'%20baseFrequency%3D'.8'%20numOctaves%3D'3'%20stitchTiles%3D'stitch'/%3E%3C/filter%3E%3Crect%20width%3D'128'%20height%3D'128'%20filter%3D'url(%23n)'%20opacity%3D'.4'/%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: MARKETING_TITLE,
  description: MARKETING_DESCRIPTION,
  openGraph: {
    title: MARKETING_TITLE,
    description: MARKETING_DESCRIPTION,
    type: "website",
    url: SITE_URL,
    siteName: "GitPreflight",
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1536,
        height: 1024,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: MARKETING_TITLE,
    description: MARKETING_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
};

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative isolate min-h-screen bg-background text-foreground font-mono text-sm leading-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 opacity-60 [background-size:44px_44px] [background-image:linear-gradient(to_right,rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.06)_1px,transparent_1px)] dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)]" />
        <div
          className="absolute inset-0 opacity-[0.04] mix-blend-multiply dark:mix-blend-screen"
          style={{ backgroundImage: `url("${NOISE_DATA_URL}")`, backgroundSize: "240px 240px" }}
        />
      </div>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:bg-background focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[78ch] items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            gitpreflight
          </Link>

          <nav aria-label="Sections" className="hidden items-center gap-1 text-sm sm:flex">
            <Link
              href="/#loop"
              className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              Loop
            </Link>
            <Link
              href="/#autonomous"
              className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              Autonomous
            </Link>
            <Link
              href="/#agent-feedback"
              className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              Feedback
            </Link>
            <Link
              href="/#install"
              className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              Install
            </Link>
            <Link
              href="/#faq"
              className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              FAQ
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/#install"
              className="rounded-md border border-dashed bg-background/60 px-3 py-1.5 text-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              Install CLI
            </Link>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[78ch] px-6 pb-3 sm:hidden">
          <nav aria-label="Sections" className="flex items-center gap-1 overflow-x-auto">
            <Link
              href="/#loop"
              className="whitespace-nowrap rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              Loop
            </Link>
            <Link
              href="/#autonomous"
              className="whitespace-nowrap rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              Autonomous
            </Link>
            <Link
              href="/#agent-feedback"
              className="whitespace-nowrap rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              Feedback
            </Link>
            <Link
              href="/#install"
              className="whitespace-nowrap rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              Install
            </Link>
            <Link
              href="/#faq"
              className="whitespace-nowrap rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              FAQ
            </Link>
          </nav>
        </div>
      </header>

      <main id="content" className="mx-auto w-full max-w-[78ch] px-6 py-10">
        {children}
      </main>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-[78ch] px-6 py-8 text-xs text-muted-foreground">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>GitPreflight</div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-md px-1.5 py-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              >
                GitHub
              </a>
              <Link
                href="/#install"
                className="rounded-md px-1.5 py-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              >
                Install
              </Link>
              <Link
                href="/#faq"
                className="rounded-md px-1.5 py-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              >
                FAQ
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
