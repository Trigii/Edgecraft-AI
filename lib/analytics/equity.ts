// Equity curve and drawdown analysis.
//
// Equity = starting balance + cumulative net P&L of closed trades in chronological order.
// Drawdown = (peak - current) / peak, expressed as a percentage from the equity high-water mark.
//
// We compute it from closed trades only — this is "realized equity". A future iteration
// will reconcile against BalanceSnapshot rows so deposits/withdrawals are not interpreted
// as performance.

import type { TradeRecord } from "./types";

export type EquityPoint = {
  t: number;             // unix ms — keeps Recharts happy and JSON-serializable
  date: string;          // ISO date, useful for axis labels
  equity: number;
  pnl: number;           // trade's net P&L, 0 for snapshots
  drawdown: number;      // negative or 0
  drawdownPct: number;   // negative or 0, in %
  tradeId?: string;
  symbol?: string;
};

export type EquityStats = {
  startingBalance: number;
  endingEquity: number;
  peakEquity: number;
  maxDrawdown: number;       // currency, negative number
  maxDrawdownPct: number;    // %, negative number
  recoveryFactor: number;    // net profit / |max drawdown|
  currentDrawdown: number;   // currency, negative or 0
  currentDrawdownPct: number;
  longestDDDurationDays: number;
};

export function computeEquityCurve(
  trades: TradeRecord[],
  startingBalance: number,
): { points: EquityPoint[]; stats: EquityStats } {
  const closed = trades
    .filter((t) => t.status === "closed" && t.pnl != null && t.closedAt)
    .sort((a, b) => a.closedAt!.getTime() - b.closedAt!.getTime());

  const points: EquityPoint[] = [];
  let equity = startingBalance;
  let peak = startingBalance;
  let maxDD = 0;
  let maxDDPct = 0;

  // Track drawdown duration: time between new equity highs.
  let lastPeakAt = closed[0]?.closedAt?.getTime() ?? Date.now();
  let longestDDDurationMs = 0;

  // Seed point so the chart shows the flat starting line.
  if (closed.length > 0) {
    const t0 = closed[0].closedAt!.getTime();
    points.push({
      t: t0 - 1,
      date: new Date(t0 - 1).toISOString(),
      equity: startingBalance,
      pnl: 0,
      drawdown: 0,
      drawdownPct: 0,
    });
  }

  for (const tr of closed) {
    const pnl = tr.pnl ?? 0;
    equity += pnl;
    if (equity > peak) {
      const dur = tr.closedAt!.getTime() - lastPeakAt;
      if (dur > longestDDDurationMs) longestDDDurationMs = dur;
      peak = equity;
      lastPeakAt = tr.closedAt!.getTime();
    }
    const dd = equity - peak;          // <= 0
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    if (dd < maxDD) maxDD = dd;
    if (ddPct < maxDDPct) maxDDPct = ddPct;
    points.push({
      t: tr.closedAt!.getTime(),
      date: tr.closedAt!.toISOString(),
      equity,
      pnl,
      drawdown: dd,
      drawdownPct: ddPct,
      tradeId: tr.id,
      symbol: tr.symbol,
    });
  }

  const endingEquity = equity;
  const netProfit = endingEquity - startingBalance;
  const currentDD = endingEquity - peak;
  const currentDDPct = peak > 0 ? (currentDD / peak) * 100 : 0;

  return {
    points,
    stats: {
      startingBalance,
      endingEquity,
      peakEquity: peak,
      maxDrawdown: maxDD,
      maxDrawdownPct: maxDDPct,
      recoveryFactor: maxDD < 0 ? netProfit / Math.abs(maxDD) : netProfit > 0 ? Infinity : 0,
      currentDrawdown: currentDD,
      currentDrawdownPct: currentDDPct,
      longestDDDurationDays: longestDDDurationMs / (1000 * 60 * 60 * 24),
    },
  };
}
