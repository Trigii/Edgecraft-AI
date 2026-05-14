"use client";

import { useState, useTransition } from "react";
import { evaluateTradeIdea } from "@/app/actions/copilot";
import { CheckCircle2, AlertTriangle, ShieldAlert, Info, ShieldCheck, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

type Result = Awaited<ReturnType<typeof evaluateTradeIdea>>;

export function PreTradeForm({
  currency,
  defaults,
}: {
  currency: string;
  defaults: { riskPerTradePct: number; minRiskReward: number };
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [form, setForm] = useState({
    symbol: "",
    direction: "long" as "long" | "short",
    entryPrice: "",
    stopLoss: "",
    takeProfit: "",
    size: "",
    emotionPre: "calm",
    confidencePre: "7",
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await evaluateTradeIdea({
        symbol: form.symbol.trim().toUpperCase(),
        direction: form.direction,
        entryPrice: Number(form.entryPrice),
        stopLoss: form.stopLoss ? Number(form.stopLoss) : null,
        takeProfit: form.takeProfit ? Number(form.takeProfit) : null,
        size: Number(form.size),
        emotionPre: form.emotionPre,
        confidencePre: form.confidencePre ? Number(form.confidencePre) : null,
      });
      setResult(r);
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <form onSubmit={submit} className="card grid grid-cols-2 gap-3">
        <Field label="Symbol" full>
          <input
            value={form.symbol}
            onChange={(e) => update("symbol", e.target.value)}
            placeholder="EURUSD"
            required
          />
        </Field>

        <Field label="Direction">
          <select value={form.direction} onChange={(e) => update("direction", e.target.value as "long" | "short")}>
            <option value="long">long</option>
            <option value="short">short</option>
          </select>
        </Field>
        <Field label="Size">
          <input
            value={form.size}
            onChange={(e) => update("size", e.target.value)}
            type="number"
            step="any"
            required
          />
        </Field>

        <Field label="Entry">
          <input
            value={form.entryPrice}
            onChange={(e) => update("entryPrice", e.target.value)}
            type="number"
            step="any"
            required
          />
        </Field>
        <Field label="Stop loss">
          <input
            value={form.stopLoss}
            onChange={(e) => update("stopLoss", e.target.value)}
            type="number"
            step="any"
          />
        </Field>

        <Field label="Take profit" full>
          <input
            value={form.takeProfit}
            onChange={(e) => update("takeProfit", e.target.value)}
            type="number"
            step="any"
          />
        </Field>

        <Field label="Emotion right now">
          <select value={form.emotionPre} onChange={(e) => update("emotionPre", e.target.value)}>
            <option value="calm">calm</option>
            <option value="confident">confident</option>
            <option value="uncertain">uncertain</option>
            <option value="fomo">FOMO</option>
            <option value="revenge">revenge</option>
          </select>
        </Field>
        <Field label="Confidence (1-10)">
          <input
            value={form.confidencePre}
            onChange={(e) => update("confidencePre", e.target.value)}
            type="number"
            min={1}
            max={10}
          />
        </Field>

        <div className="col-span-2 flex items-center justify-between">
          <p className="text-xs text-ink-subtle">
            Default risk per trade: {defaults.riskPerTradePct}% · Min R:R: {defaults.minRiskReward}:1
          </p>
          <button disabled={pending} type="submit" className="btn-primary">
            {pending ? "Analyzing…" : "Validate trade"} <ArrowRight size={14} />
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {!result && (
          <div className="card-tight text-sm text-ink-muted">
            Fill in the trade idea and click Validate. The copilot will check stop loss, R:R, position size, daily loss limit, tilt, and overtrading.
          </div>
        )}
        {result && <Verdict result={result} currency={currency} />}
        {result && (
          <div className="card-tight flex items-center justify-between text-sm">
            <span className="text-ink-muted">Happy with the plan?</span>
            <Link
              href={`/journal/new?symbol=${encodeURIComponent(form.symbol)}`}
              className="btn-ghost text-xs"
            >
              Log this trade →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Verdict({ result, currency }: { result: Result; currency: string }) {
  const tone =
    result.decision === "go" ? "bull" : result.decision === "stop" ? "bear" : "warn";
  const Icon =
    result.decision === "go" ? CheckCircle2 : result.decision === "stop" ? ShieldAlert : AlertTriangle;
  const label =
    result.decision === "go"
      ? "Setup approved"
      : result.decision === "stop"
        ? "Do not take this trade"
        : "Proceed with caution";
  return (
    <>
      <div
        className={`card border-2 ${
          tone === "bull"
            ? "border-bull/40"
            : tone === "bear"
              ? "border-bear/40"
              : "border-warn/40"
        }`}
      >
        <div className="flex items-center gap-2">
          <Icon
            size={20}
            className={tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-warn"}
          />
          <div className="font-semibold">{label}</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 text-sm">
          <Metric label="Risk amount" value={formatCurrency(result.metrics.riskAmount, currency)} />
          <Metric label="Reward amount" value={formatCurrency(result.metrics.rewardAmount, currency)} />
          <Metric
            label="Risk / Reward"
            value={result.metrics.riskRewardRatio > 0 ? `${result.metrics.riskRewardRatio.toFixed(2)}:1` : "—"}
          />
          <Metric label="Risk % of account" value={`${result.metrics.riskPctOfAccount.toFixed(2)}%`} />
          <Metric label="Reward % of account" value={`${result.metrics.rewardPctOfAccount.toFixed(2)}%`} />
          <Metric
            label="Suggested size"
            value={result.metrics.suggestedSize > 0 ? result.metrics.suggestedSize.toFixed(4) : "—"}
            sub="to match your risk %"
          />
        </div>
      </div>

      <div className="space-y-2">
        {result.validations.map((v, i) => (
          <ValidationCard key={i} v={v} />
        ))}
      </div>
    </>
  );
}

function ValidationCard({ v }: { v: { level: string; title: string; message: string; code: string } }) {
  const map: Record<string, { Icon: typeof Info; cls: string }> = {
    block: { Icon: ShieldAlert, cls: "border-bear/40 bg-bear/5 text-bear" },
    warn: { Icon: AlertTriangle, cls: "border-warn/40 bg-warn/5 text-warn" },
    info: { Icon: Info, cls: "border-info/30 bg-info/5 text-info" },
    ok: { Icon: ShieldCheck, cls: "border-bull/40 bg-bull/5 text-bull" },
  };
  const cfg = map[v.level] ?? map.info;
  return (
    <div className={`card-tight border-l-2 ${cfg.cls}`}>
      <div className="flex items-start gap-2">
        <cfg.Icon size={16} className="shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-medium text-ink">{v.title}</div>
          <div className="text-xs text-ink-muted mt-0.5">{v.message}</div>
        </div>
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

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-ink-subtle uppercase tracking-wider">{label}</div>
      <div className="font-mono mt-0.5">{value}</div>
      {sub && <div className="text-xs text-ink-subtle">{sub}</div>}
    </div>
  );
}
