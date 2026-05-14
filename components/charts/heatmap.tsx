"use client";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Maps a P&L value to a color in a diverging palette (red → neutral → green).
// We use a square-root scale so single outliers don't wash out the heatmap.
function colorFor(pnl: number, absMax: number) {
  if (absMax === 0 || pnl === 0) return "rgb(21 27 35)";
  const intensity = Math.min(1, Math.sqrt(Math.abs(pnl) / absMax));
  if (pnl > 0) {
    const alpha = 0.15 + intensity * 0.75;
    return `rgba(34, 197, 94, ${alpha})`;
  }
  const alpha = 0.15 + intensity * 0.75;
  return `rgba(239, 68, 68, ${alpha})`;
}

export function HourDayHeatmap({
  data,
}: {
  data: { day: number; hour: number; pnl: number; trades: number; winRate: number }[];
}) {
  const absMax = Math.max(...data.map((d) => Math.abs(d.pnl)), 1);
  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="grid" style={{ gridTemplateColumns: "44px repeat(24, minmax(20px, 1fr))" }}>
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-[10px] text-ink-subtle text-center py-1">
              {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
            </div>
          ))}
          {DAYS.map((label, d) => (
            <DayRow key={d} day={d} label={label} data={data} absMax={absMax} />
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs text-ink-muted">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: "rgba(239,68,68,0.6)" }} />
            <span>loss</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-bg-elevated border border-bg-border" />
            <span>no trades</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: "rgba(34,197,94,0.6)" }} />
            <span>profit</span>
          </div>
          <span className="ml-auto">all times UTC</span>
        </div>
      </div>
    </div>
  );
}

function DayRow({
  day,
  label,
  data,
  absMax,
}: {
  day: number;
  label: string;
  data: { day: number; hour: number; pnl: number; trades: number; winRate: number }[];
  absMax: number;
}) {
  const row = data.filter((d) => d.day === day);
  return (
    <>
      <div className="text-xs text-ink-muted flex items-center pr-2">{label}</div>
      {Array.from({ length: 24 }, (_, h) => {
        const cell = row.find((r) => r.hour === h) ?? { pnl: 0, trades: 0, winRate: 0 };
        const title =
          cell.trades > 0
            ? `${label} ${String(h).padStart(2, "0")}:00 — ${cell.trades} trade(s), P&L ${cell.pnl.toFixed(
                2,
              )}, WR ${cell.winRate.toFixed(0)}%`
            : `${label} ${String(h).padStart(2, "0")}:00 — no trades`;
        return (
          <div
            key={h}
            title={title}
            className="aspect-square rounded-sm m-[1px] border border-bg-border/40"
            style={{ background: colorFor(cell.pnl, absMax) }}
          />
        );
      })}
    </>
  );
}
