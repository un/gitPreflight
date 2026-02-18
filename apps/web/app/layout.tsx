import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { getToken } from "@/lib/auth-server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://gitpreflight.ai";
const OG_IMAGE_ALT = "GitPreflight commit and push review loop preview image";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "GitPreflight",
  description: "PR-style reviews on git commit and git push, with feedback sent directly to your coding agent before a PR is opened.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
    other: [
      { rel: "icon", url: "/android-chrome-192x192.png", type: "image/png", sizes: "192x192" },
      { rel: "icon", url: "/android-chrome-512x512.png", type: "image/png", sizes: "512x512" },
    ],
  },
  openGraph: {
    images: [
      {
        url: "/og.png",
        width: 1536,
        height: 1024,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = await getToken();
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ConvexClientProvider initialToken={token}>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
