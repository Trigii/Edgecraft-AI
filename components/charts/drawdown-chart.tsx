"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint } from "@/lib/analytics/equity";

export function DrawdownChart({ points }: { points: EquityPoint[] }) {
  if (points.length === 0) {
    return <div className="text-sm text-ink-muted">No data yet.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={points} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.05} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="t"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(t) => new Date(t).toLocaleDateString()}
          tick={{ fontSize: 11 }}
          stroke="#5a6677"
        />
        <YAxis
          tick={{ fontSize: 11 }}
          stroke="#5a6677"
          tickFormatter={(v) => `${v.toFixed(1)}%`}
          domain={["auto", 0]}
        />
        <Tooltip
          contentStyle={{
            background: "#0f1419",
            border: "1px solid #1f2630",
            borderRadius: 6,
            fontSize: 12,
          }}
          labelFormatter={(t) => new Date(t).toLocaleString()}
          formatter={(v: number) => [`${v.toFixed(2)}%`, "Drawdown"]}
        />
        <Area
          type="monotone"
          dataKey="drawdownPct"
          stroke="#ef4444"
          strokeWidth={1.5}
          fill="url(#ddFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
