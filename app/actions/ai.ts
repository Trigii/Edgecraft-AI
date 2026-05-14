"use server";

import { aiAsk, aiReview, aiTradePostMortem, isAiEnabled } from "@/lib/ai/copilot";
import { getDefaultUser, getActiveAccount, getTradesForAccount } from "@/lib/queries";
import { computeCoreMetrics, computeEquityCurve, computeRiskMetrics, byStat } from "@/lib/analytics";
import { prisma } from "@/lib/db";

async function getStatsContext() {
  const user = await getDefaultUser();
  const account = await getActiveAccount(user.id);
  if (!account) throw new Error("No active account");
  const trades = await getTradesForAccount(account.id);
  const core = computeCoreMetrics(trades);
  const { stats: equity } = computeEquityCurve(trades, account.initialBalance);
  const risk = computeRiskMetrics(trades, account.initialBalance, equity.maxDrawdownPct);
  const groups = byStat(trades);
  const recentTrades = await prisma.trade.findMany({
    where: { accountId: account.id, status: "closed" },
    orderBy: { closedAt: "desc" },
    take: 5,
    select: { symbol: true, pnl: true, notes: true, mistakes: true },
  });
  return {
    core,
    equity,
    risk,
    topSymbols: groups.bySymbol.slice(0, 3),
    worstSymbols: groups.bySymbol.slice(-3).reverse(),
    recentNotes: recentTrades
      .filter((t) => t.notes || t.mistakes)
      .map((t) => `${t.symbol} ${(t.pnl ?? 0).toFixed(2)}: ${t.notes ?? ""}${t.mistakes ? ` [mistakes: ${t.mistakes}]` : ""}`),
  };
}

export async function runAiWeeklyReview() {
  if (!isAiEnabled()) throw new Error("AI not configured. Set ANTHROPIC_API_KEY.");
  const ctx = await getStatsContext();
  return aiReview(ctx);
}

export async function runAiAsk(question: string) {
  if (!isAiEnabled()) throw new Error("AI not configured. Set ANTHROPIC_API_KEY.");
  const ctx = await getStatsContext();
  return aiAsk(ctx, question);
}

export async function runAiPostMortem(trade: {
  symbol: string;
  direction: string;
  pnl: number;
  rMultiple: number | null;
  thesis: string | null;
  notes: string | null;
  outcome: string | null;
}) {
  if (!isAiEnabled()) throw new Error("AI not configured. Set ANTHROPIC_API_KEY.");
  return aiTradePostMortem(trade);
}
