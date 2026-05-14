"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  computeRiskAmount,
  computeRewardAmount,
  computeRiskRewardRatio,
} from "@/lib/analytics/metrics";

export function CalculatorClient({
  balance,
  currency,
  defaultRiskPct,
  defaultMinRR,
}: {
  balance: number;
  currency: string;
  defaultRiskPct: number;
  defaultMinRR: number;
}) {
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [entry, setEntry] = useState<string>("");
  const [stop, setStop] = useState<string>("");
  const [tp, setTp] = useState<string>("");
  const [riskPct, setRiskPct] = useState<string>(String(defaultRiskPct));
  const [manualSize, setManualSize] = useState<string>("");

  const entryN = Number(entry) || 0;
  const stopN = Number(stop) || 0;
  const tpN = Number(tp) || 0;
  const riskPctN = Number(riskPct) || 0;
  const manualSizeN = Number(manualSize) || 0;

  const result = useMemo(() => {
    const allowedRisk = balance * (riskPctN / 100);
    const distance =
      stopN > 0 && entryN > 0
        ? direction === "long"
          ? entryN - stopN
          : stopN - entryN
        : 0;
    const suggestedSize = distance > 0 ? allowedRisk / distance : 0;
    const sizeUsed = manualSizeN > 0 ? manualSizeN : suggestedSize;
    const risk =
      stopN > 0 && sizeUsed > 0
        ? computeRiskAmount({ direction, entryPrice: entryN, stopLoss: stopN, size: sizeUsed })
        : 0;
    const reward =
      tpN > 0 && sizeUsed > 0
        ? computeRewardAmount({ direction, entryPrice: entryN, takeProfit: tpN, size: sizeUsed })
        : 0;
    const rr =
      stopN > 0 && tpN > 0
        ? computeRiskRewardRatio({ direction, entryPrice: entryN, stopLoss: stopN, takeProfit: tpN })
        : 0;
    const riskPctActual = balance > 0 ? (risk / balance) * 100 : 0;
    const rewardPctActual = balance > 0 ? (reward / balance) * 100 : 0;

    return {
      allowedRisk,
      distance,
      suggestedSize,
      sizeUsed,
      risk,
      reward,
      rr,
      riskPctActual,
      rewardPctActual,
      meetsMinRR: rr >= defaultMinRR,
    };
  }, [balance, riskPctN, manualSizeN, entryN, stopN, tpN, direction, defaultMinRR]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card grid grid-cols-2 gap-3">
        <Field label="Direction">
          <select value={direction} onChange={(e) => setDirection(e.target.value as "long" | "short")}>
            <option value="long">long</option>
            <option value="short">short</option>
          </select>
        </Field>
        <Field label="Risk % of account">
          <input value={riskPct} onChange={(e) => setRiskPct(e.target.value)} type="number" step="0.1" />
        </Field>

        <Field label="Entry price">
          <input value={entry} onChange={(e) => setEntry(e.target.value)} type="number" step="any" />
        </Field>
        <Field label="Stop loss">
          <input value={stop} onChange={(e) => setStop(e.target.value)} type="number" step="any" />
        </Field>

        <Field label="Take profit (optional)">
          <input value={tp} onChange={(e) => setTp(e.target.value)} type="number" step="any" />
        </Field>
        <Field label="Manual size (override)">
          <input
            value={manualSize}
            onChange={(e) => setManualSize(e.target.value)}
            type="number"
            step="any"
            placeholder="leave blank to use suggested"
          />
        </Field>

        <p className="col-span-2 text-xs text-ink-subtle">
          Account balance: {formatCurrency(balance, currency)}. Risking{" "}
          {formatCurrency(result.allowedRisk, currency)} per trade at {riskPctN}%.
        </p>
      </div>

      <div className="space-y-3">
        <div className="card">
          <div className="grid grid-cols-2 gap-4">
            <Out
              label="Suggested size"
              value={result.suggestedSize > 0 ? result.suggestedSize.toFixed(4) : "—"}
              sub="for your risk %"
            />
            <Out
              label="Effective size"
              value={result.sizeUsed > 0 ? result.sizeUsed.toFixed(4) : "—"}
              sub={manualSizeN > 0 ? "your override" : "= suggested"}
            />
            <Out
              label="Risk amount"
              value={result.risk > 0 ? formatCurrency(result.risk, currency) : "—"}
              sub={`${result.riskPctActual.toFixed(2)}% of account`}
            />
            <Out
              label="Reward amount"
              value={result.reward > 0 ? formatCurrency(result.reward, currency) : "—"}
              sub={result.rewardPctActual > 0 ? `${result.rewardPctActual.toFixed(2)}% of account` : ""}
            />
            <Out
              label="R:R"
              value={result.rr > 0 ? `${result.rr.toFixed(2)}:1` : "—"}
              sub={`min target ${defaultMinRR}:1`}
              tone={result.rr > 0 ? (result.meetsMinRR ? "bull" : "warn") : "default"}
            />
            <Out
              label="Stop distance"
              value={result.distance > 0 ? result.distance.toFixed(5) : "—"}
              sub="entry → stop"
            />
          </div>
        </div>

        {result.rr > 0 && (
          <div
            className={`card-tight border-l-2 ${
              result.meetsMinRR ? "border-bull bg-bull/5" : "border-warn bg-warn/5"
            } text-sm`}
          >
            {result.meetsMinRR ? (
              <>R:R clears your minimum. Plan looks executable.</>
            ) : (
              <>R:R is below your minimum of {defaultMinRR}:1. Tighten the stop, push the target, or skip the setup.</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "col-span-2" : ""}`}>
      <span className="text-xs text-ink-subtle uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}

function Out({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "bull" | "warn";
}) {
  const t = tone === "bull" ? "text-bull" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div>
      <div className="text-xs text-ink-subtle uppercase tracking-wider">{label}</div>
      <div className={`font-mono text-lg mt-0.5 ${t}`}>{value}</div>
      {sub && <div className="text-xs text-ink-subtle">{sub}</div>}
    </div>
  );
}
