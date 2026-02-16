import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "@gitpreflight/convex";

export const runtime = "nodejs";

const QuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(3650).optional()
});

export async function GET(request: Request) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return NextResponse.json({ error: "missing_convex_url" }, { status: 500 });

  const url = new URL(request.url);
  const rawDays = url.searchParams.get("days");

  const parsed = QuerySchema.safeParse({ days: rawDays ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query", details: parsed.error.flatten() }, { status: 400 });
  }

  const client = new ConvexHttpClient(convexUrl);
  try {
    const summary = await client.query(api.analytics.getPublicFunnelSummary, {
      days: parsed.data.days
    });

    return NextResponse.json(summary, {
      headers: {
        "cache-control": "public, s-maxage=60, stale-while-revalidate=300"
      }
    });
  } catch {
    return NextResponse.json({ error: "analytics_unavailable" }, { status: 503 });
  }
}
