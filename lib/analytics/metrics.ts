// Core trading metrics — pure functions over closed trades.
//
// Conventions:
//   - "pnl" is net P&L in account currency (fees + swap already subtracted upstream).
//   - A "win" is pnl > 0, "loss" is pnl < 0, "breakeven" is pnl === 0.
//   - Streaks count consecutive wins or consecutive losses, in trade order.
//   - We treat missing pnl as 0 (defensive — open trades should be filtered out before).

import type { TradeRecord } from "./types";

export type CoreMetrics = {
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;            // 0..100
  grossProfit: number;
  grossLoss: number;
  netPnl: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;       // gross profit / gross loss
  payoffRatio: number;        // avg win / |avg loss|
  expectancy: number;         // avg P&L per trade
  expectancyR: number;        // avg R-multiple per trade
  avgRWin: number;
  avgRLoss: number;
  bestStreakWins: number;
  worstStreakLosses: number;
  feesTotal: number;
  swapTotal: number;
  avgHoldMinutes: number;
  avgConfidence: number | null;
};

const isClosed = (t: TradeRecord) => t.status === "closed" && t.pnl != null;

export function computeCoreMetrics(trades: TradeRecord[]): CoreMetrics {
  const closed = trades.filter(isClosed);

  let wins = 0,
    losses = 0,
    breakevens = 0;
  let grossProfit = 0,
    grossLoss = 0;
  let largestWin = 0,
    largestLoss = 0;
  let feesTotal = 0,
    swapTotal = 0;
  let rWinSum = 0,
    rWinCount = 0,
    rLossSum = 0,
    rLossCount = 0;
  let rSum = 0,
    rCount = 0;
  let holdMinutesSum = 0,
    holdMinutesCount = 0;
  let confidenceSum = 0,
    confidenceCount = 0;

  let curStreakWins = 0,
    curStreakLosses = 0;
  let bestStreakWins = 0,
    worstStreakLosses = 0;

  // Order by close time so streak math is meaningful.
  const ordered = [...closed].sort(
    (a, b) => (a.closedAt?.getTime() ?? 0) - (b.closedAt?.getTime() ?? 0),
  );

  for (const t of ordered) {
    const pnl = t.pnl ?? 0;
    feesTotal += t.fees ?? 0;
    swapTotal += t.swap ?? 0;

    if (pnl > 0) {
      wins++;
      grossProfit += pnl;
      if (pnl > largestWin) largestWin = pnl;
      curStreakWins++;
      curStreakLosses = 0;
      if (curStreakWins > bestStreakWins) bestStreakWins = curStreakWins;
    } else if (pnl < 0) {
      losses++;
      grossLoss += Math.abs(pnl);
      if (pnl < largestLoss) largestLoss = pnl;
      curStreakLosses++;
      curStreakWins = 0;
      if (curStreakLosses > worstStreakLosses) worstStreakLosses = curStreakLosses;
    } else {
      breakevens++;
      curStreakWins = 0;
      curStreakLosses = 0;
    }

    if (t.rMultiple != null) {
      rSum += t.rMultiple;
      rCount++;
      if (t.rMultiple > 0) {
        rWinSum += t.rMultiple;
        rWinCount++;
      } else if (t.rMultiple < 0) {
        rLossSum += t.rMultiple;
        rLossCount++;
      }
    }

    if (t.openedAt && t.closedAt) {
      const minutes = (t.closedAt.getTime() - t.openedAt.getTime()) / 60000;
      if (minutes >= 0) {
        holdMinutesSum += minutes;
        holdMinutesCount++;
      }
    }

    if (t.confidencePre != null) {
      confidenceSum += t.confidencePre;
      confidenceCount++;
    }
  }

  const total = closed.length;
  const netPnl = grossProfit - grossLoss;
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const avgWin = wins > 0 ? grossProfit / wins : 0;
  const avgLoss = losses > 0 ? grossLoss / losses : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
  const expectancy = total > 0 ? netPnl / total : 0;

  return {
    totalTrades: total,
    wins,
    losses,
    breakevens,
    winRate,
    grossProfit,
    grossLoss,
    netPnl,
    avgWin,
    avgLoss,
    largestWin,
    largestLoss,
    profitFactor,
    payoffRatio,
    expectancy,
    expectancyR: rCount > 0 ? rSum / rCount : 0,
    avgRWin: rWinCount > 0 ? rWinSum / rWinCount : 0,
    avgRLoss: rLossCount > 0 ? rLossSum / rLossCount : 0,
    bestStreakWins,
    worstStreakLosses,
    feesTotal,
    swapTotal,
    avgHoldMinutes: holdMinutesCount > 0 ? holdMinutesSum / holdMinutesCount : 0,
    avgConfidence: confidenceCount > 0 ? confidenceSum / confidenceCount : null,
  };
}

// Compute realized P&L for a single trade. Used both at close time (server action)
// and inside the pre-trade simulator so the trader sees the worst- and best-case math
// before they click.
//
// For forex this is a simplification — real lot sizes vary by broker. The model
// is "size * price-delta - costs", which is correct for stocks/crypto and a useful
// approximation for FX standard lots when "size" is the unit count.
export function computeTradePnl(args: {
  direction: "long" | "short" | string;
  entryPrice: number;
  exitPrice: number;
  size: number;
  fees?: number;
  swap?: number;
}) {
  const { direction, entryPrice, exitPrice, size, fees = 0, swap = 0 } = args;
  const delta = direction === "short" ? entryPrice - exitPrice : exitPrice - entryPrice;
  const gross = delta * size;
  return gross - fees - swap;
}

// Risk on a trade is the distance from entry to stop loss, expressed in account currency.
// Used to compute R-multiples and to validate position size before entry.
export function computeRiskAmount(args: {
  direction: "long" | "short" | string;
  entryPrice: number;
  stopLoss: number;
  size: number;
}) {
  const { direction, entryPrice, stopLoss, size } = args;
  if (!stopLoss) return 0;
  const delta = direction === "short" ? stopLoss - entryPrice : entryPrice - stopLoss;
  return Math.max(0, delta * size);
}

// Reward at target = distance from entry to take profit, in account currency.
export function computeRewardAmount(args: {
  direction: "long" | "short" | string;
  entryPrice: number;
  takeProfit: number;
  size: number;
}) {
  const { direction, entryPrice, takeProfit, size } = args;
  if (!takeProfit) return 0;
  const delta = direction === "short" ? entryPrice - takeProfit : takeProfit - entryPrice;
  return Math.max(0, delta * size);
}

export function computeRiskRewardRatio(args: {
  direction: "long" | "short" | string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
}) {
  const { direction, entryPrice, stopLoss, takeProfit } = args;
  if (!stopLoss || !takeProfit) return 0;
  const risk =
    direction === "short" ? stopLoss - entryPrice : entryPrice - stopLoss;
  const reward =
    direction === "short" ? entryPrice - takeProfit : takeProfit - entryPrice;
  if (risk <= 0 || reward <= 0) return 0;
  return reward / risk;
}
