// Read-side queries used by server components.
// Encapsulates "get me the default user / default account" logic so pages stay simple.

import { prisma } from "./db";
import type { TradeRecord } from "./analytics/types";

// v0.1 is single-user. We bootstrap a "default" user on first run and return it.
// Multi-user/auth is a future iteration — see ROADMAP in the README.
export async function getDefaultUser() {
  let user = await prisma.user.findFirst({ include: { settings: true } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Trader",
        settings: { create: {} },
      },
      include: { settings: true },
    });
  } else if (!user.settings) {
    await prisma.settings.create({ data: { userId: user.id } });
    user = await prisma.user.findFirst({ include: { settings: true } });
  }
  return user!;
}

export async function getActiveAccount(userId: string) {
  return prisma.account.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAllAccounts(userId: string) {
  return prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getTradesForAccount(accountId: string): Promise<TradeRecord[]> {
  const trades = await prisma.trade.findMany({
    where: { accountId },
    orderBy: { openedAt: "asc" },
  });
  return trades.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    assetType: t.assetType,
    direction: t.direction,
    size: t.size,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    stopLoss: t.stopLoss,
    takeProfit: t.takeProfit,
    fees: t.fees,
    swap: t.swap,
    openedAt: t.openedAt,
    closedAt: t.closedAt,
    status: t.status,
    outcome: t.outcome,
    pnl: t.pnl,
    pnlPct: t.pnlPct,
    rMultiple: t.rMultiple,
    strategyId: t.strategyId,
    emotionPre: t.emotionPre,
    emotionPost: t.emotionPost,
    confidencePre: t.confidencePre,
  }));
}

// Snapshot of "today" relative to a trader's timezone. Defaults to UTC.
// Used by the pre-trade copilot to compute daily P&L and trade count.
export async function getTodayContext(accountId: string) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const [closedToday, openTradesCount] = await Promise.all([
    prisma.trade.findMany({
      where: {
        accountId,
        status: "closed",
        closedAt: { gte: start, lt: end },
      },
      orderBy: { closedAt: "asc" },
    }),
    prisma.trade.count({ where: { accountId, status: "open" } }),
  ]);

  return { closedToday, openTradesCount };
}
