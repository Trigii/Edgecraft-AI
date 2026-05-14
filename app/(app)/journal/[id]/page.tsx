import { prisma } from "@/lib/db";
import { Section } from "@/components/ui/section";
import { Kpi } from "@/components/ui/kpi";
import { closeTrade, deleteTrade, updateTradeNotes } from "@/app/actions/trades";
import { formatCurrency, signed } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isAiEnabled } from "@/lib/ai/copilot";
import { AiPostMortem } from "./post-mortem";

export const dynamic = "force-dynamic";

export default async function TradeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trade = await prisma.trade.findUnique({
    where: { id },
    include: { strategy: true, account: true, tags: { include: { tag: true } } },
  });
  if (!trade) notFound();
  const t = trade;
  const currency = t.account.currency;

  return (
    <div className="space-y-5">
      <Section
        title={`${t.symbol} ${t.direction.toUpperCase()}`}
        subtitle={`${t.assetType} · ${t.account.name} · opened ${t.openedAt.toISOString().slice(0, 16).replace("T", " ")}`}
        action={
          <form action={deleteTrade}>
            <input type="hidden" name="tradeId" value={t.id} />
            <button type="submit" className="btn-danger text-xs">
              Delete
            </button>
          </form>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi
            label="P&L"
            value={t.pnl != null ? formatCurrency(t.pnl, currency) : "—"}
            sub={t.pnl != null ? signed((t.pnlPct ?? 0)) + "% of starting balance" : ""}
            tone={t.pnl == null ? "default" : t.pnl >= 0 ? "bull" : "bear"}
          />
          <Kpi
            label="R-multiple"
            value={t.rMultiple != null ? `${t.rMultiple.toFixed(2)}R` : "—"}
            tone={t.rMultiple == null ? "default" : t.rMultiple >= 0 ? "bull" : "bear"}
          />
          <Kpi label="Size" value={String(t.size)} sub={`leverage ${t.leverage}x`} />
          <Kpi label="Fees + swap" value={formatCurrency((t.fees ?? 0) + (t.swap ?? 0), currency)} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
          <Kpi label="Entry" value={t.entryPrice.toFixed(5)} />
          <Kpi label="Stop loss" value={t.stopLoss != null ? t.stopLoss.toFixed(5) : "—"} tone={t.stopLoss ? "default" : "warn"} />
          <Kpi label="Take profit" value={t.takeProfit != null ? t.takeProfit.toFixed(5) : "—"} />
          <Kpi label="Exit" value={t.exitPrice != null ? t.exitPrice.toFixed(5) : "—"} />
          <Kpi label="Status" value={t.status} tone={t.status === "open" ? "warn" : "default"} />
        </div>
      </Section>

      {t.status === "open" && (
        <Section title="Close this trade">
          <form action={closeTrade} className="card grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="hidden" name="tradeId" value={t.id} />
            <Field label="Exit price *">
              <input name="exitPrice" type="number" step="any" required />
            </Field>
            <Field label="Closed at *">
              <input
                name="closedAt"
                type="datetime-local"
                defaultValue={new Date().toISOString().slice(0, 16)}
                required
              />
            </Field>
            <Field label="Fees">
              <input name="fees" type="number" step="any" defaultValue={t.fees ?? 0} />
            </Field>
            <Field label="Swap / financing">
              <input name="swap" type="number" step="any" defaultValue={t.swap ?? 0} />
            </Field>
            <Field label="Post-trade emotion">
              <select name="emotionPost" defaultValue="">
                <option value="">—</option>
                <option value="calm">calm</option>
                <option value="frustrated">frustrated</option>
                <option value="euphoric">euphoric</option>
                <option value="regret">regret</option>
                <option value="proud">proud</option>
              </select>
            </Field>
            <Field label="Notes" full>
              <textarea name="notes" rows={2} placeholder="What happened?" />
            </Field>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button type="submit" className="btn-primary">Close trade</button>
            </div>
          </form>
        </Section>
      )}

      <Section title="Thesis & notes" subtitle="The post-mortem is where you actually learn.">
        {t.thesis && (
          <div className="card">
            <div className="text-xs uppercase tracking-wider text-ink-subtle mb-2">Pre-trade thesis</div>
            <div className="whitespace-pre-wrap text-sm">{t.thesis}</div>
          </div>
        )}
        <form action={updateTradeNotes} className="card flex flex-col gap-3">
          <input type="hidden" name="tradeId" value={t.id} />
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-ink-subtle">Notes / post-mortem</span>
            <textarea name="notes" rows={5} defaultValue={t.notes ?? ""} placeholder="What did I do right? Wrong? What rule did I break or follow?" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-ink-subtle">Mistakes (comma-separated)</span>
            <input name="mistakes" defaultValue={t.mistakes ?? ""} placeholder="moved-stop, no-confirmation, oversized" />
          </label>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">Save</button>
          </div>
        </form>

        {isAiEnabled() && t.status === "closed" && (
          <AiPostMortem
            trade={{
              id: t.id,
              symbol: t.symbol,
              direction: t.direction,
              pnl: t.pnl ?? 0,
              rMultiple: t.rMultiple,
              thesis: t.thesis,
              notes: t.notes,
              outcome: t.outcome,
            }}
          />
        )}
      </Section>

      <Section title="Context">
        <div className="card grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-subtle">Strategy</div>
            <div className="mt-1">{t.strategy?.name ?? <span className="text-ink-muted">—</span>}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-subtle">Pre-trade emotion</div>
            <div className="mt-1">{t.emotionPre ?? <span className="text-ink-muted">—</span>}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-ink-subtle">Confidence</div>
            <div className="mt-1">{t.confidencePre != null ? `${t.confidencePre}/10` : <span className="text-ink-muted">—</span>}</div>
          </div>
          {t.tags.length > 0 && (
            <div className="md:col-span-3 flex flex-wrap gap-1.5">
              {t.tags.map(({ tag }) => (
                <span key={tag.id} className="badge-muted" style={{ borderColor: tag.color + "55" }}>
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </Section>

      <div>
        <Link href="/journal" className="link text-sm">← Back to journal</Link>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-xs text-ink-subtle uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}
