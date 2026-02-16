import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";

function dayKeyUtc(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function isValidInstallId(installId: string): boolean {
  return installId.length >= 16 && installId.length <= 128;
}

function trimOptional(value?: string): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 64) : undefined;
}

export const recordInstall = mutation({
  args: {
    installId: v.string(),
    channel: v.string(),
    cliVersion: v.optional(v.string()),
    platform: v.optional(v.string()),
    arch: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    if (!isValidInstallId(args.installId)) throw new Error("invalid_install_id");

    const now = Date.now();
    const existing = await ctx.db
      .query("anonymousInstalls")
      .withIndex("by_installId", (q) => q.eq("installId", args.installId))
      .unique();

    const incomingChannel = args.channel.slice(0, 64);
    const next = {
      cliVersion: trimOptional(args.cliVersion),
      platform: trimOptional(args.platform),
      arch: trimOptional(args.arch),
      lastSeenAtMs: now
    };

    if (!existing) {
      await ctx.db.insert("anonymousInstalls", {
        installId: args.installId,
        channel: incomingChannel,
        ...next,
        createdAtMs: now,
        triggerCount: 0
      });
      return { ok: true, firstSeen: true };
    }

    await ctx.db.patch(existing._id, {
      ...next,
      channel: existing.channel === "unknown" ? incomingChannel : existing.channel
    });
    return { ok: true, firstSeen: false };
  }
});

export const recordTrigger = mutation({
  args: {
    installId: v.string(),
    mode: v.string(),
    localAgent: v.boolean(),
    status: v.optional(v.string()),
    cliVersion: v.optional(v.string()),
    platform: v.optional(v.string()),
    arch: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    if (!isValidInstallId(args.installId)) throw new Error("invalid_install_id");

    const now = Date.now();
    const day = dayKeyUtc(now);

    const install = await ctx.db
      .query("anonymousInstalls")
      .withIndex("by_installId", (q) => q.eq("installId", args.installId))
      .unique();

    if (!install) {
      await ctx.db.insert("anonymousInstalls", {
        installId: args.installId,
        channel: "unknown",
        cliVersion: trimOptional(args.cliVersion),
        platform: trimOptional(args.platform),
        arch: trimOptional(args.arch),
        createdAtMs: now,
        lastSeenAtMs: now,
        firstTriggerAtMs: now,
        triggerCount: 1
      });
    } else {
      await ctx.db.patch(install._id, {
        lastSeenAtMs: now,
        cliVersion: trimOptional(args.cliVersion) ?? install.cliVersion,
        platform: trimOptional(args.platform) ?? install.platform,
        arch: trimOptional(args.arch) ?? install.arch,
        firstTriggerAtMs: install.firstTriggerAtMs ?? now,
        triggerCount: (install.triggerCount ?? 0) + 1
      });
    }

    await ctx.db.insert("anonymousTriggers", {
      installId: args.installId,
      mode: args.mode.slice(0, 32),
      localAgent: args.localAgent,
      status: trimOptional(args.status),
      cliVersion: trimOptional(args.cliVersion),
      platform: trimOptional(args.platform),
      arch: trimOptional(args.arch),
      createdAtMs: now,
      day
    });

    return { ok: true };
  }
});

const MAX_WINDOW_DAYS = 3650;

function normalizeWindowDays(days?: number): number | null {
  if (typeof days !== "number" || Number.isNaN(days)) return null;
  const rounded = Math.floor(days);
  if (rounded <= 0) return null;
  return Math.min(rounded, MAX_WINDOW_DAYS);
}

async function loadInstallsSince(ctx: QueryCtx, sinceMs: number | null) {
  if (sinceMs == null) {
    return await ctx.db.query("anonymousInstalls").collect();
  }

  return await ctx.db
    .query("anonymousInstalls")
    .withIndex("by_createdAtMs", (q) => q.gte("createdAtMs", sinceMs))
    .collect();
}

async function loadTriggersSince(ctx: QueryCtx, sinceMs: number | null) {
  if (sinceMs == null) {
    return await ctx.db.query("anonymousTriggers").collect();
  }

  return await ctx.db
    .query("anonymousTriggers")
    .withIndex("by_createdAtMs", (q) => q.gte("createdAtMs", sinceMs))
    .collect();
}

export const getPublicFunnelSummary = query({
  args: {
    days: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const windowDays = normalizeWindowDays(args.days);
    const sinceMs = windowDays == null ? null : now - windowDays * 24 * 60 * 60 * 1000;

    const installs = await loadInstallsSince(ctx, sinceMs);
    const triggers = await loadTriggersSince(ctx, sinceMs);

    const installCount = installs.length;
    const activatedInstalls = installs.filter((i) => typeof i.firstTriggerAtMs === "number").length;
    const triggerCount = triggers.length;
    const uniqueTriggeringInstalls = new Set(triggers.map((t) => t.installId)).size;

    const conversionRate = installCount > 0 ? activatedInstalls / installCount : 0;

    return {
      generatedAtMs: now,
      windowDays,
      installs: installCount,
      activatedInstalls,
      triggers: triggerCount,
      uniqueTriggeringInstalls,
      conversionRate,
      conversionPercent: Math.round(conversionRate * 10000) / 100
    };
  }
});
