import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "@gitpreflight/convex";

export const runtime = "nodejs";

const InstallEventSchema = z.object({
  installId: z.string().min(16).max(128),
  channel: z.string().min(1).max(64),
  cliVersion: z.string().min(1).max(64).optional(),
  platform: z.string().min(1).max(32).optional(),
  arch: z.string().min(1).max(32).optional()
});

export async function POST(request: Request) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return NextResponse.json({ error: "missing_convex_url" }, { status: 500 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = InstallEventSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }

  const client = new ConvexHttpClient(convexUrl);
  try {
    await client.mutation(api.analytics.recordInstall, parsed.data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "analytics_unavailable" }, { status: 503 });
  }
}
