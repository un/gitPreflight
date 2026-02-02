import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyApiToken(
  ctx: MutationCtx,
  token: string
): Promise<{ userId: string; orgId: Id<"orgs"> } | null> {
  const tokenHash = await sha256Hex(token);
  const rec = await ctx.db
    .query("apiTokens")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();

  if (!rec) return null;
  if (rec.revokedAtMs) return null;
  if (!rec.orgId) return null;
  return { userId: rec.userId, orgId: rec.orgId };
}

function dayKeyUtc(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

const FREE_DAILY_REVIEW_LIMIT = 50;

export const consumeReviewRun = mutation({
  args: {
    token: v.string(),
    planTier: v.string()
  },
  handler: async (
    ctx,
    args
  ): Promise<{ allowed: boolean; day: string; count: number; limit: number | null }> => {
    const auth = await verifyApiToken(ctx, args.token);
    if (!auth) throw new Error("unauthorized");

    const planTier = args.planTier === "paid" ? "paid" : "free";
    const limit = planTier === "paid" ? null : FREE_DAILY_REVIEW_LIMIT;
    const day = dayKeyUtc(Date.now());

    let rec = await ctx.db
      .query("usageDaily")
      .withIndex("by_orgId_userId_day", (q) => q.eq("orgId", auth.orgId).eq("userId", auth.userId).eq("day", day))
      .unique();

    if (!rec) {
      const id = await ctx.db.insert("usageDaily", {
        orgId: auth.orgId,
        userId: auth.userId,
        day,
        count: 0
      });
      rec = await ctx.db.get(id);
    }

    if (!rec) throw new Error("failed_to_create_usage");

    if (limit != null && rec.count >= limit) {
      return { allowed: false, day, count: rec.count, limit };
    }

    await ctx.db.patch(rec._id, { count: rec.count + 1 });
    return { allowed: true, day, count: rec.count + 1, limit };
  }
});
