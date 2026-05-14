// Rule-based pattern detection over a trader's history.
//
// Philosophy: every insight here has to actionable. "You lost money" is not insight;
// "you lose money on Fridays after 16:00 UTC, and your stops are wider there" is.
//
// Each rule returns 0 or more InsightDraft objects. The caller persists them.
// Rules run on a finite window (default: all closed trades) and only fire when there
// is enough data — we never want to generate a confident-sounding insight from 3 trades.

import type { TradeRecord } from "../analytics/types";
import { computeCoreMetrics } from "../analytics/metrics";
import { byStat } from "../analytics/groupings";

export type InsightDraft = {
  kind: "pattern" | "warning" | "strength" | "suggestion";
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

const MIN_TRADES_FOR_BEHAVIORAL = 20;
const MIN_TRADES_PER_BUCKET = 5;

type RuleContext = {
  trades: TradeRecord[];
  closed: TradeRecord[];
};

type Rule = (ctx: RuleContext) => InsightDraft[];

// ---------- Rules ----------

// 1. Critical: trades without stop loss.
const noStopLossRule: Rule = ({ closed }) => {
  if (closed.length < 10) return [];
  const noSL = closed.filter((t) => !t.stopLoss);
  const ratio = noSL.length / closed.length;
  if (ratio < 0.05) return [];
  return [
    {
      kind: "warning",
      severity: ratio > 0.25 ? "critical" : "high",
      title: `${Math.round(ratio * 100)}% of your trades have no stop loss`,
      body:
        "Trading without a stop loss is the #1 reason new accounts get blown. " +
        "Even a wide stop is better than none. Set one before every entry — the copilot " +
        "can enforce this in your settings.",
      data: { ratio, count: noSL.length, total: closed.length },
    },
  ];
};

// 2. Profit factor below 1 — net losing system.
const negativeEdgeRule: Rule = ({ closed }) => {
  if (closed.length < MIN_TRADES_FOR_BEHAVIORAL) return [];
  const m = computeCoreMetrics(closed);
  if (m.profitFactor >= 1.0) return [];
  return [
    {
      kind: "warning",
      severity: "high",
      title: `Profit factor is ${m.profitFactor.toFixed(2)} — system is currently unprofitable`,
      body:
        `You're earning ${m.profitFactor.toFixed(2)} for every $1 you lose. ` +
        `Two fixes work: (a) cut your losers faster — your average loss is ` +
        `$${m.avgLoss.toFixed(2)} vs avg win of $${m.avgWin.toFixed(2)}, or ` +
        `(b) require minimum R:R of ${(1 / m.winRate * 100).toFixed(1)}:1 to break even at your current win rate.`,
      data: { profitFactor: m.profitFactor, avgWin: m.avgWin, avgLoss: m.avgLoss },
    },
  ];
};

// 3. Letting winners go too small (closing too early).
const cuttingWinnersShortRule: Rule = ({ closed }) => {
  if (closed.length < MIN_TRADES_FOR_BEHAVIORAL) return [];
  const m = computeCoreMetrics(closed);
  if (m.avgRWin === 0 || Math.abs(m.avgRLoss) === 0) return [];
  const ratio = m.avgRWin / Math.abs(m.avgRLoss);
  if (ratio >= 1.2) return [];
  return [
    {
      kind: "pattern",
      severity: "medium",
      title: "You're cutting winners short",
      body:
        `Your average winner is ${m.avgRWin.toFixed(2)}R but average loser is ` +
        `${Math.abs(m.avgRLoss).toFixed(2)}R. Healthy systems have win/loss R-ratio of 1.5+. ` +
        `Consider trailing stops instead of fixed take-profits, or move TP further when ` +
        `momentum is in your favor.`,
      data: { ratio, avgRWin: m.avgRWin, avgRLoss: m.avgRLoss },
    },
  ];
};

// 4. Time-of-day edge — fire only when a clear edge exists.
const bestHourRule: Rule = ({ closed }) => {
  if (closed.length < MIN_TRADES_FOR_BEHAVIORAL) return [];
  const groups = byStat(closed).byHour.filter((g) => g.trades >= MIN_TRADES_PER_BUCKET);
  if (groups.length < 3) return [];
  const sorted = [...groups].sort((a, b) => b.expectancy - a.expectancy);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  if (best.expectancy <= 0 || worst.expectancy >= 0) return [];
  if (best.expectancy < Math.abs(worst.expectancy) * 0.5) return [];
  return [
    {
      kind: "strength",
      severity: "info",
      title: `Your best trading hour is ${best.label}`,
      body:
        `At ${best.label} you average $${best.expectancy.toFixed(2)} per trade over ` +
        `${best.trades} trades (win rate ${best.winRate.toFixed(0)}%). ` +
        `At ${worst.label}, you lose $${Math.abs(worst.expectancy).toFixed(2)} per trade. ` +
        `Stop forcing trades outside your best window.`,
      data: { best, worst },
    },
  ];
};

// 5. Day-of-week edge.
const worstDayRule: Rule = ({ closed }) => {
  if (closed.length < MIN_TRADES_FOR_BEHAVIORAL) return [];
  const groups = byStat(closed).byDayOfWeek.filter((g) => g.trades >= MIN_TRADES_PER_BUCKET);
  if (groups.length < 3) return [];
  const sorted = [...groups].sort((a, b) => a.expectancy - b.expectancy);
  const worst = sorted[0];
  if (worst.expectancy >= 0) return [];
  return [
    {
      kind: "warning",
      severity: "medium",
      title: `${worst.label} is your weakest day`,
      body:
        `Over ${worst.trades} ${worst.label} trades you average -$${Math.abs(worst.expectancy).toFixed(2)} ` +
        `per trade with ${worst.winRate.toFixed(0)}% win rate. ` +
        `Skip ${worst.label} for two weeks and measure the impact.`,
      data: { day: worst },
    },
  ];
};

// 6. Per-symbol edge.
const bestSymbolRule: Rule = ({ closed }) => {
  if (closed.length < MIN_TRADES_FOR_BEHAVIORAL) return [];
  const groups = byStat(closed).bySymbol.filter((g) => g.trades >= MIN_TRADES_PER_BUCKET);
  if (groups.length < 2) return [];
  const best = groups[0];
  const worst = groups[groups.length - 1];
  const insights: InsightDraft[] = [];
  if (best.expectancy > 0) {
    insights.push({
      kind: "strength",
      severity: "info",
      title: `${best.label} is your strongest instrument`,
      body:
        `${best.label}: ${best.winRate.toFixed(0)}% win rate, ` +
        `+$${best.expectancy.toFixed(2)} per trade across ${best.trades} trades. ` +
        `This is where your edge lives — consider concentrating size here.`,
      data: { symbol: best },
    });
  }
  if (worst.expectancy < 0 && worst.trades >= MIN_TRADES_PER_BUCKET) {
    insights.push({
      kind: "warning",
      severity: "medium",
      title: `${worst.label} is consistently bleeding you out`,
      body:
        `${worst.label}: ${worst.winRate.toFixed(0)}% win rate, ` +
        `-$${Math.abs(worst.expectancy).toFixed(2)} per trade across ${worst.trades} trades. ` +
        `If you don't know why this symbol is different, stop trading it.`,
      data: { symbol: worst },
    });
  }
  return insights;
};

// 7. Tilt / revenge trading detection — looks at the *most recent* sequence.
const tiltRule: Rule = ({ closed }) => {
  if (closed.length < 5) return [];
  const recent = [...closed]
    .sort((a, b) => (a.closedAt?.getTime() ?? 0) - (b.closedAt?.getTime() ?? 0))
    .slice(-10);
  // Find the latest run of consecutive losses
  let consecLosses = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    if ((recent[i].pnl ?? 0) < 0) consecLosses++;
    else break;
  }
  if (consecLosses < 3) return [];
  return [
    {
      kind: "warning",
      severity: consecLosses >= 5 ? "critical" : "high",
      title: `You're on a ${consecLosses}-loss streak`,
      body:
        "This is when most traders blow up: revenge trades, oversizing, abandoning the plan. " +
        "Pre-trade copilot will now require you to wait at least 30 minutes between trades and " +
        "complete the checklist. Consider stopping for the day if your daily loss limit is near.",
      data: { consecLosses },
    },
  ];
};

// 8. Overtrading frequency.
const overtradingRule: Rule = ({ closed }) => {
  if (closed.length < 30) return [];
  const byDate = new Map<string, number>();
  for (const t of closed) {
    if (!t.closedAt) continue;
    const d = t.closedAt.toISOString().slice(0, 10);
    byDate.set(d, (byDate.get(d) ?? 0) + 1);
  }
  const counts = Array.from(byDate.values()).sort((a, b) => b - a);
  if (counts.length < 5) return [];
  const median = counts[Math.floor(counts.length / 2)];
  const heavyDays = counts.filter((c) => c > median * 2.5);
  if (heavyDays.length === 0) return [];

  // Now compute expectancy on heavy days vs normal days.
  const heavyDateSet = new Set(
    Array.from(byDate.entries()).filter(([, c]) => c > median * 2.5).map(([d]) => d),
  );
  let heavyPnl = 0,
    heavyTrades = 0,
    normalPnl = 0,
    normalTrades = 0;
  for (const t of closed) {
    if (!t.closedAt) continue;
    const d = t.closedAt.toISOString().slice(0, 10);
    if (heavyDateSet.has(d)) {
      heavyPnl += t.pnl ?? 0;
      heavyTrades++;
    } else {
      normalPnl += t.pnl ?? 0;
      normalTrades++;
    }
  }
  const heavyExp = heavyTrades > 0 ? heavyPnl / heavyTrades : 0;
  const normalExp = normalTrades > 0 ? normalPnl / normalTrades : 0;
  if (heavyExp >= normalExp) return [];
  return [
    {
      kind: "pattern",
      severity: "medium",
      title: "You overtrade — and it costs you",
      body:
        `On heavy days (>${Math.round(median * 2.5)} trades) you earn $${heavyExp.toFixed(2)} per trade, ` +
        `vs $${normalExp.toFixed(2)} on normal days. Set a daily trade cap — ` +
        `quality compounds, quantity dilutes.`,
      data: { heavyExp, normalExp, threshold: median * 2.5 },
    },
  ];
};

// 9. Direction bias.
const directionBiasRule: Rule = ({ closed }) => {
  if (closed.length < MIN_TRADES_FOR_BEHAVIORAL) return [];
  const longs = closed.filter((t) => t.direction === "long");
  const shorts = closed.filter((t) => t.direction === "short");
  if (longs.length < MIN_TRADES_PER_BUCKET || shorts.length < MIN_TRADES_PER_BUCKET) return [];
  const longExp = longs.reduce((a, t) => a + (t.pnl ?? 0), 0) / longs.length;
  const shortExp = shorts.reduce((a, t) => a + (t.pnl ?? 0), 0) / shorts.length;
  const skew = longs.length / closed.length;
  if (Math.abs(skew - 0.5) < 0.2) return [];
  const dominant = skew > 0.5 ? "long" : "short";
  const dominantExp = dominant === "long" ? longExp : shortExp;
  const otherExp = dominant === "long" ? shortExp : longExp;
  if (otherExp <= dominantExp) return [];
  return [
    {
      kind: "pattern",
      severity: "low",
      title: `You have a strong ${dominant} bias — but it's costing you`,
      body:
        `${Math.round((dominant === "long" ? skew : 1 - skew) * 100)}% of your trades are ${dominant}, ` +
        `expectancy $${dominantExp.toFixed(2)}. Your ${dominant === "long" ? "shorts" : "longs"} ` +
        `actually perform better at $${otherExp.toFixed(2)}. Look for setups in both directions.`,
      data: { skew, longExp, shortExp },
    },
  ];
};

// 10. Confidence calibration.
const confidenceCalibrationRule: Rule = ({ closed }) => {
  const rated = closed.filter((t) => t.confidencePre != null);
  if (rated.length < MIN_TRADES_FOR_BEHAVIORAL) return [];
  const high = rated.filter((t) => (t.confidencePre ?? 0) >= 8);
  const low = rated.filter((t) => (t.confidencePre ?? 0) <= 5);
  if (high.length < MIN_TRADES_PER_BUCKET || low.length < MIN_TRADES_PER_BUCKET) return [];
  const highWinRate = high.filter((t) => (t.pnl ?? 0) > 0).length / high.length;
  const lowWinRate = low.filter((t) => (t.pnl ?? 0) > 0).length / low.length;
  if (highWinRate - lowWinRate > 0.1) return [];
  return [
    {
      kind: "pattern",
      severity: "medium",
      title: "Your confidence isn't predictive",
      body:
        `Trades you rated 8-10 confidence: ${(highWinRate * 100).toFixed(0)}% win rate. ` +
        `Trades you rated ≤5: ${(lowWinRate * 100).toFixed(0)}%. ` +
        `Your gut feel isn't a leading indicator — trust your checklist, not the vibe.`,
      data: { highWinRate, lowWinRate },
    },
  ];
};

// 11. Emotion correlation.
const emotionalTradingRule: Rule = ({ closed }) => {
  const fomo = closed.filter((t) => t.emotionPre === "fomo");
  const revenge = closed.filter((t) => t.emotionPre === "revenge");
  const insights: InsightDraft[] = [];
  for (const [label, rows] of [
    ["FOMO", fomo],
    ["revenge", revenge],
  ] as const) {
    if (rows.length < MIN_TRADES_PER_BUCKET) continue;
    const exp = rows.reduce((a, t) => a + (t.pnl ?? 0), 0) / rows.length;
    if (exp >= 0) continue;
    insights.push({
      kind: "warning",
      severity: "high",
      title: `${label} trades bleed money`,
      body:
        `When you tagged a trade as "${label.toLowerCase()}", expectancy was -$${Math.abs(exp).toFixed(2)}. ` +
        `If you feel ${label.toLowerCase()} before entry, the pre-trade copilot will require a 15-minute cool-down.`,
      data: { label, exp, count: rows.length },
    });
  }
  return insights;
};

// 12. Strength: high win rate symbols/strategies (for confidence building).
const winRateStrengthRule: Rule = ({ closed }) => {
  if (closed.length < MIN_TRADES_FOR_BEHAVIORAL) return [];
  const m = computeCoreMetrics(closed);
  if (m.winRate < 55 || m.profitFactor < 1.3) return [];
  return [
    {
      kind: "strength",
      severity: "info",
      title: "You have a measurable edge",
      body:
        `${m.winRate.toFixed(0)}% win rate, profit factor ${m.profitFactor.toFixed(2)}, ` +
        `expectancy $${m.expectancy.toFixed(2)} over ${m.totalTrades} trades. ` +
        `The work now is consistency — same setup, same risk, same process.`,
      data: { winRate: m.winRate, profitFactor: m.profitFactor },
    },
  ];
};

const ALL_RULES: Rule[] = [
  noStopLossRule,
  negativeEdgeRule,
  cuttingWinnersShortRule,
  bestHourRule,
  worstDayRule,
  bestSymbolRule,
  tiltRule,
  overtradingRule,
  directionBiasRule,
  confidenceCalibrationRule,
  emotionalTradingRule,
  winRateStrengthRule,
];

export function generateInsights(trades: TradeRecord[]): InsightDraft[] {
  const closed = trades.filter((t) => t.status === "closed" && t.pnl != null);
  const ctx: RuleContext = { trades, closed };
  const out: InsightDraft[] = [];
  for (const rule of ALL_RULES) {
    try {
      out.push(...rule(ctx));
    } catch {
      // a single broken rule shouldn't sink the batch
    }
  }
  return out;
}
