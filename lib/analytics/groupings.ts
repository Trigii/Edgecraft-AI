// Group trades by various dimensions and compute summary stats per group.
//
// These power the dashboard's "where is my edge?" tables and heatmaps:
//   - by symbol (which pair pays me?)
//   - by hour of day (am I a morning trader?)
//   - by day of week (do I lose money on Fridays?)
//   - by direction (do I have a long bias that hurts me?)
//   - by strategy
//   - by duration bucket (scalps vs swings)

import type { TradeRecord, GroupedStat } from "./types";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function summarize(key: string, label: string, rows: TradeRecord[]): GroupedStat {
  const closed = rows.filter((t) => t.status === "closed" && t.pnl != null);
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0).length;
  const losses = closed.filter((t) => (t.pnl ?? 0) < 0).length;
  const pnl = closed.reduce((a, t) => a + (t.pnl ?? 0), 0);
  const trades = closed.length;
  return {
    key,
    label,
    trades,
    wins,
    losses,
    winRate: trades > 0 ? (wins / trades) * 100 : 0,
    pnl,
    expectancy: trades > 0 ? pnl / trades : 0,
  };
}

function groupBy<K extends string>(
  trades: TradeRecord[],
  keyFn: (t: TradeRecord) => { key: K; label: string },
): GroupedStat[] {
  const groups = new Map<string, { label: string; rows: TradeRecord[] }>();
  for (const t of trades) {
    const { key, label } = keyFn(t);
    const g = groups.get(key);
    if (g) g.rows.push(t);
    else groups.set(key, { label, rows: [t] });
  }
  return Array.from(groups.entries())
    .map(([key, { label, rows }]) => summarize(key, label, rows))
    .sort((a, b) => b.pnl - a.pnl);
}

export function byStat(trades: TradeRecord[]) {
  return {
    bySymbol: groupBy(trades, (t) => ({ key: t.symbol, label: t.symbol })),
    byDirection: groupBy(trades, (t) => ({ key: t.direction, label: t.direction })),
    byAssetType: groupBy(trades, (t) => ({ key: t.assetType, label: t.assetType })),
    byStrategy: groupBy(trades, (t) => ({
      key: t.strategyId ?? "none",
      label: t.strategyId ?? "untagged",
    })),
    byHour: groupBy(trades, (t) => {
      const h = t.openedAt.getUTCHours();
      return { key: String(h), label: `${String(h).padStart(2, "0")}:00 UTC` };
    }),
    byDayOfWeek: groupBy(trades, (t) => {
      const d = t.openedAt.getUTCDay();
      return { key: String(d), label: DOW_LABELS[d] };
    }),
    byDuration: groupBy(trades, (t) => {
      if (!t.closedAt) return { key: "open", label: "open" };
      const mins = (t.closedAt.getTime() - t.openedAt.getTime()) / 60000;
      if (mins < 15) return { key: "scalp", label: "< 15m (scalp)" };
      if (mins < 60) return { key: "intraday-short", label: "15m–1h" };
      if (mins < 240) return { key: "intraday-mid", label: "1h–4h" };
      if (mins < 1440) return { key: "intraday-long", label: "4h–1d" };
      if (mins < 10080) return { key: "swing", label: "1d–1w" };
      return { key: "position", label: "> 1w" };
    }),
    byEmotionPre: groupBy(
      trades.filter((t) => t.emotionPre),
      (t) => ({ key: t.emotionPre!, label: t.emotionPre! }),
    ),
  };
}

// 7x24 grid of P&L: day-of-week (rows) × hour-of-day (cols). Used by the heatmap.
export function hourDayHeatmap(trades: TradeRecord[]) {
  const grid: { day: number; hour: number; pnl: number; trades: number; winRate: number }[] = [];
  const buckets = new Map<string, { pnl: number; trades: number; wins: number }>();
  for (const t of trades) {
    if (t.status !== "closed" || t.pnl == null) continue;
    const d = t.openedAt.getUTCDay();
    const h = t.openedAt.getUTCHours();
    const key = `${d}-${h}`;
    const b = buckets.get(key) ?? { pnl: 0, trades: 0, wins: 0 };
    b.pnl += t.pnl;
    b.trades += 1;
    if (t.pnl > 0) b.wins += 1;
    buckets.set(key, b);
  }
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const b = buckets.get(`${d}-${h}`);
      grid.push({
        day: d,
        hour: h,
        pnl: b?.pnl ?? 0,
        trades: b?.trades ?? 0,
        winRate: b && b.trades > 0 ? (b.wins / b.trades) * 100 : 0,
      });
    }
  }
  return grid;
}
