// Risk-adjusted return metrics — the numbers institutional traders care about.
//
// We bucket trades into daily returns first, because per-trade Sharpe is noisy and not
// comparable to industry conventions. Days without trades produce 0 returns and are
// included in the denominator (this is intentional — sitting flat is part of strategy).
//
// Annualization assumes 252 trading days. Crypto traders may prefer 365; this can be
// surfaced as a setting later.

import type { TradeRecord } from "./types";

const TRADING_DAYS_PER_YEAR = 252;

export type RiskMetrics = {
  sharpe: number;             // mean / stddev * sqrt(N)
  sortino: number;            // mean / downside-stddev * sqrt(N)
  calmar: number;             // annualized return / max drawdown
  stdDevDaily: number;
  averageDailyReturn: number;
  positiveDays: number;
  negativeDays: number;
  bestDay: number;
  worstDay: number;
};

export function dailyReturns(
  trades: TradeRecord[],
  startingBalance: number,
): { date: string; pnl: number; ret: number }[] {
  const closed = trades.filter((t) => t.status === "closed" && t.pnl != null && t.closedAt);
  if (closed.length === 0) return [];

  closed.sort((a, b) => a.closedAt!.getTime() - b.closedAt!.getTime());

  const byDay = new Map<string, number>();
  for (const t of closed) {
    const d = t.closedAt!.toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + (t.pnl ?? 0));
  }

  let equity = startingBalance;
  const out: { date: string; pnl: number; ret: number }[] = [];
  for (const [date, pnl] of Array.from(byDay.entries()).sort()) {
    const ret = equity > 0 ? pnl / equity : 0;
    equity += pnl;
    out.push({ date, pnl, ret });
  }
  return out;
}

function stddev(values: number[], mean: number) {
  if (values.length < 2) return 0;
  const v = values.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

export function computeRiskMetrics(
  trades: TradeRecord[],
  startingBalance: number,
  maxDrawdownPct: number,
): RiskMetrics {
  const returns = dailyReturns(trades, startingBalance);
  if (returns.length === 0) {
    return {
      sharpe: 0,
      sortino: 0,
      calmar: 0,
      stdDevDaily: 0,
      averageDailyReturn: 0,
      positiveDays: 0,
      negativeDays: 0,
      bestDay: 0,
      worstDay: 0,
    };
  }

  const rets = returns.map((r) => r.ret);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = stddev(rets, mean);

  const downside = rets.filter((r) => r < 0);
  const downsideSd = downside.length > 0 ? Math.sqrt(downside.reduce((a, b) => a + b * b, 0) / downside.length) : 0;

  const annualized = mean * TRADING_DAYS_PER_YEAR;
  const sharpe = sd > 0 ? (mean / sd) * Math.sqrt(TRADING_DAYS_PER_YEAR) : 0;
  const sortino = downsideSd > 0 ? (mean / downsideSd) * Math.sqrt(TRADING_DAYS_PER_YEAR) : 0;
  const calmar = maxDrawdownPct < 0 ? annualized / Math.abs(maxDrawdownPct / 100) : 0;

  let positiveDays = 0,
    negativeDays = 0,
    bestDay = 0,
    worstDay = 0;
  for (const r of returns) {
    if (r.pnl > 0) positiveDays++;
    else if (r.pnl < 0) negativeDays++;
    if (r.pnl > bestDay) bestDay = r.pnl;
    if (r.pnl < worstDay) worstDay = r.pnl;
  }

  return {
    sharpe,
    sortino,
    calmar,
    stdDevDaily: sd * 100,
    averageDailyReturn: mean * 100,
    positiveDays,
    negativeDays,
    bestDay,
    worstDay,
  };
}
