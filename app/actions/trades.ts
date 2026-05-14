"use server";

// Server actions for trade lifecycle: log, close, update, delete.
// We compute P&L and R-multiples on close so the dashboard never re-derives them
// for every chart render. The Trade model stores both raw inputs and the derived
// metrics — slightly redundant but the right trade-off for read-heavy analytics.

import { prisma } from "@/lib/db";
import { computeTradePnl, computeRiskAmount } from "@/lib/analytics/metrics";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "next/navigation";

const NewTradeSchema = z.object({
  accountId: z.string().min(1),
  symbol: z.string().min(1).transform((s) => s.trim().toUpperCase()),
  assetType: z.enum(["forex", "stock", "crypto", "future", "option", "index"]).default("forex"),
  direction: z.enum(["long", "short"]),
  size: z.coerce.number().positive(),
  entryPrice: z.coerce.number().positive(),
  stopLoss: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  takeProfit: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  exitPrice: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  fees: z.coerce.number().min(0).default(0),
  swap: z.coerce.number().default(0),
  openedAt: z.string().min(1),
  closedAt: z.string().optional().or(z.literal("").transform(() => undefined)),
  strategyId: z.string().optional().or(z.literal("").transform(() => undefined)),
  thesis: z.string().optional(),
  notes: z.string().optional(),
  emotionPre: z.string().optional().or(z.literal("").transform(() => undefined)),
  emotionPost: z.string().optional().or(z.literal("").transform(() => undefined)),
  confidencePre: z.coerce.number().min(1).max(10).optional().or(z.literal("").transform(() => undefined)),
  tags: z.string().optional(), // comma-separated
});

function deriveOutcomes(input: {
  direction: string;
  entryPrice: number;
  exitPrice: number;
  stopLoss?: number | null;
  size: number;
  fees: number;
  swap: number;
}) {
  const pnl = computeTradePnl({
    direction: input.direction,
    entryPrice: input.entryPrice,
    exitPrice: input.exitPrice,
    size: input.size,
    fees: input.fees,
    swap: input.swap,
  });
  const risk = input.stopLoss
    ? computeRiskAmount({
        direction: input.direction,
        entryPrice: input.entryPrice,
        stopLoss: input.stopLoss,
        size: input.size,
      })
    : 0;
  const rMultiple = risk > 0 ? pnl / risk : null;
  const outcome = pnl > 0 ? "win" : pnl < 0 ? "loss" : "breakeven";
  return { pnl, rMultiple, outcome, risk };
}

export async function createTrade(formData: FormData) {
  const parsed = NewTradeSchema.parse(Object.fromEntries(formData));

  const opened = new Date(parsed.openedAt);
  const closed = parsed.closedAt ? new Date(parsed.closedAt) : null;
  const isClosed = parsed.exitPrice != null && closed != null;

  let derived: ReturnType<typeof deriveOutcomes> | null = null;
  if (isClosed) {
    derived = deriveOutcomes({
      direction: parsed.direction,
      entryPrice: parsed.entryPrice,
      exitPrice: parsed.exitPrice!,
      stopLoss: parsed.stopLoss,
      size: parsed.size,
      fees: parsed.fees,
      swap: parsed.swap,
    });
  }

  const account = await prisma.account.findUnique({ where: { id: parsed.accountId } });

  const trade = await prisma.trade.create({
    data: {
      accountId: parsed.accountId,
      symbol: parsed.symbol,
      assetType: parsed.assetType,
      direction: parsed.direction,
      size: parsed.size,
      entryPrice: parsed.entryPrice,
      stopLoss: parsed.stopLoss ?? null,
      takeProfit: parsed.takeProfit ?? null,
      exitPrice: parsed.exitPrice ?? null,
      fees: parsed.fees,
      swap: parsed.swap,
      openedAt: opened,
      closedAt: closed,
      status: isClosed ? "closed" : "open",
      outcome: derived?.outcome ?? null,
      pnl: derived?.pnl ?? null,
      pnlPct: derived && account ? (derived.pnl / account.initialBalance) * 100 : null,
      rMultiple: derived?.rMultiple ?? null,
      strategyId: parsed.strategyId ?? null,
      thesis: parsed.thesis ?? null,
      notes: parsed.notes ?? null,
      emotionPre: parsed.emotionPre ?? null,
      emotionPost: parsed.emotionPost ?? null,
      confidencePre: parsed.confidencePre ?? null,
    },
  });

  if (parsed.tags) {
    const tagNames = parsed.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagNames.length > 0 && account) {
      const user = await prisma.user.findFirst({ select: { id: true } });
      if (user) {
        for (const name of tagNames) {
          const tag = await prisma.tag.upsert({
            where: { userId_name: { userId: user.id, name } },
            update: {},
            create: { userId: user.id, name },
          });
          await prisma.tradeTag.create({ data: { tradeId: trade.id, tagId: tag.id } });
        }
      }
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/journal");
  revalidatePath("/insights");
  redirect(`/journal/${trade.id}`);
}

export async function closeTrade(formData: FormData) {
  const tradeId = String(formData.get("tradeId"));
  const exitPrice = Number(formData.get("exitPrice"));
  const closedAtRaw = formData.get("closedAt")?.toString();
  const fees = Number(formData.get("fees") ?? 0);
  const swap = Number(formData.get("swap") ?? 0);
  const notes = formData.get("notes")?.toString() ?? "";
  const emotionPost = formData.get("emotionPost")?.toString() ?? "";

  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error("Trade not found");

  const account = await prisma.account.findUnique({ where: { id: trade.accountId } });
  const derived = deriveOutcomes({
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    exitPrice,
    stopLoss: trade.stopLoss,
    size: trade.size,
    fees,
    swap,
  });

  await prisma.trade.update({
    where: { id: tradeId },
    data: {
      exitPrice,
      closedAt: closedAtRaw ? new Date(closedAtRaw) : new Date(),
      fees,
      swap,
      notes: notes || trade.notes,
      emotionPost: emotionPost || trade.emotionPost,
      status: "closed",
      outcome: derived.outcome,
      pnl: derived.pnl,
      pnlPct: account ? (derived.pnl / account.initialBalance) * 100 : null,
      rMultiple: derived.rMultiple,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/journal");
  revalidatePath(`/journal/${tradeId}`);
  revalidatePath("/insights");
}

export async function deleteTrade(formData: FormData) {
  const tradeId = String(formData.get("tradeId"));
  await prisma.trade.delete({ where: { id: tradeId } });
  revalidatePath("/dashboard");
  revalidatePath("/journal");
  redirect("/journal");
}

export async function updateTradeNotes(formData: FormData) {
  const tradeId = String(formData.get("tradeId"));
  const notes = formData.get("notes")?.toString() ?? "";
  const mistakes = formData.get("mistakes")?.toString() ?? "";
  await prisma.trade.update({
    where: { id: tradeId },
    data: { notes, mistakes },
  });
  revalidatePath(`/journal/${tradeId}`);
}
