"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function PnlBars({
  data,
  yKey = "pnl",
  xKey = "label",
  height = 220,
}: {
  data: { label: string; pnl: number; [k: string]: unknown }[];
  yKey?: string;
  xKey?: string;
  height?: number;
}) {
  if (data.length === 0) {
    return <div className="text-sm text-ink-muted">No data yet.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="#5a6677" interval={0} angle={-20} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 11 }} stroke="#5a6677" tickFormatter={(v) => v.toFixed(0)} />
        <Tooltip
          contentStyle={{
            background: "#0f1419",
            border: "1px solid #1f2630",
            borderRadius: 6,
            fontSize: 12,
          }}
          formatter={(v: number) => [v.toFixed(2), "P&L"]}
        />
        <Bar dataKey={yKey} radius={[2, 2, 0, 0]}>
          {data.map((row, idx) => {
            const v = row[yKey] as number;
            return <Cell key={idx} fill={v >= 0 ? "#22c55e" : "#ef4444"} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
