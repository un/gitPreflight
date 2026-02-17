import { NextResponse } from "next/server";
import { z } from "zod";
import { capturePosthogUsageEvent } from "@/lib/posthog";

export const runtime = "nodejs";

const UsageBodySchema = z.object({
  installId: z.string().min(16).max(128)
});

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = UsageBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await capturePosthogUsageEvent("usage/review", parsed.data.installId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "usage_unavailable" }, { status: 503 });
  }
}
