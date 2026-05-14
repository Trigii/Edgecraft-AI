"use server";

import { evaluatePreTrade } from "@/lib/insights/pretrade";
import type { PreTradeInput } from "@/lib/insights/pretrade";
import { getDefaultUser, getActiveAccount, getTodayContext } from "@/lib/queries";
import { prisma } from "@/lib/db";

export async function evaluateTradeIdea(input: PreTradeInput) {
  const user = await getDefaultUser();
  const account = await getActiveAccount(user.id);
  if (!account || !user.settings) throw new Error("No active account or settings");

  // Pull current balance: starting balance + closed-trade P&L. Fine for v0.1;
  // future versions will reconcile against the BalanceSnapshot table.
  const closedAgg = await prisma.trade.aggregate({
    where: { accountId: account.id, status: "closed" },
    _sum: { pnl: true },
  });
  const balance = account.initialBalance + (closedAgg._sum.pnl ?? 0);

  const today = await getTodayContext(account.id);
  const recentClosed = await prisma.trade.findMany({
    where: { accountId: account.id, status: "closed" },
    orderBy: { closedAt: "desc" },
    take: 10,
  });

  const result = evaluatePreTrade(
    input,
    {
      balance,
      currency: account.currency,
      openTradesCount: today.openTradesCount,
      closedToday: today.closedToday.map(asTradeRecord),
      recentClosed: recentClosed.map(asTradeRecord).reverse(),
    },
    {
      riskPerTradePct: user.settings.riskPerTradePct,
      maxDailyLossPct: user.settings.maxDailyLossPct,
      maxOpenTrades: user.settings.maxOpenTrades,
      minRiskReward: user.settings.minRiskReward,
      enforcePreTradeChecklist: user.settings.enforcePreTradeChecklist,
      tiltDetectionEnabled: user.settings.tiltDetectionEnabled,
      overtradingThreshold: user.settings.overtradingThreshold,
    },
  );

  return { ...result, balance, currency: account.currency };
}

function asTradeRecord(t: {
  id: string;
  symbol: string;
  assetType: string;
  direction: string;
  size: number;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  fees: number;
  swap: number;
  openedAt: Date;
  closedAt: Date | null;
  status: string;
  outcome: string | null;
  pnl: number | null;
  pnlPct: number | null;
  rMultiple: number | null;
  strategyId: string | null;
  emotionPre: string | null;
  emotionPost: string | null;
  confidencePre: number | null;
}) {
  return t;
}
