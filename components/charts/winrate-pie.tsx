"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export function WinRatePie({
  wins,
  losses,
  breakevens,
}: {
  wins: number;
  losses: number;
  breakevens: number;
}) {
  const data = [
    { name: "Wins", value: wins, fill: "#22c55e" },
    { name: "Losses", value: losses, fill: "#ef4444" },
    { name: "Breakeven", value: breakevens, fill: "#5a6677" },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <div className="text-sm text-ink-muted">No closed trades.</div>;
  }

  const total = wins + losses + breakevens;
  const winPct = total > 0 ? (wins / total) * 100 : 0;

  return (
    <div className="relative h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={2}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#0f1419",
              border: "1px solid #1f2630",
              borderRadius: 6,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-2xl font-mono font-semibold">{winPct.toFixed(0)}%</div>
        <div className="text-xs text-ink-muted">win rate</div>
      </div>
    </div>
  );
}
