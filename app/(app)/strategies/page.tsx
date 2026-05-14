import { Section } from "@/components/ui/section";
import { Empty } from "@/components/ui/empty";
import { prisma } from "@/lib/db";
import { getDefaultUser, getActiveAccount, getTradesForAccount } from "@/lib/queries";
import { computeCoreMetrics } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";
import { archiveStrategy, createStrategy, unarchiveStrategy } from "@/app/actions/strategies";

export const dynamic = "force-dynamic";

export default async function StrategiesPage() {
  const user = await getDefaultUser();
  const account = await getActiveAccount(user.id);
  const strategies = await prisma.strategy.findMany({
    where: { userId: user.id },
    orderBy: [{ isArchived: "asc" }, { name: "asc" }],
  });

  const trades = account ? await getTradesForAccount(account.id) : [];
  const currency = account?.currency ?? "USD";

  return (
    <div className="space-y-6">
      <Section
        title="Strategies"
        subtitle="A strategy is a playbook. Tag trades with the playbook you followed, then compare which one actually pays you."
      >
        {strategies.length === 0 ? (
          <Empty title="No strategies yet" subtitle="Define your first playbook below." />
        ) : (
          <div className="card">
            <table className="w-full text-sm">
              <thead className="text-ink-subtle text-left">
                <tr>
                  <th className="py-2 font-normal">Name</th>
                  <th className="py-2 font-normal text-right">Trades</th>
                  <th className="py-2 font-normal text-right">Win rate</th>
                  <th className="py-2 font-normal text-right">P&L</th>
                  <th className="py-2 font-normal text-right">PF</th>
                  <th className="py-2 font-normal text-right">Exp/trade</th>
                  <th className="py-2 font-normal text-right">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {strategies.map((s) => {
                  const sTrades = trades.filter((t) => t.strategyId === s.id);
                  const m = computeCoreMetrics(sTrades);
                  return (
                    <tr key={s.id} className="border-t border-bg-border">
                      <td className="py-2">
                        <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: s.color }} />
                        <span className="font-medium">{s.name}</span>
                        {s.description && (
                          <div className="text-xs text-ink-muted">{s.description}</div>
                        )}
                      </td>
                      <td className="py-2 text-right font-mono">{m.totalTrades}</td>
                      <td className="py-2 text-right font-mono">{m.winRate.toFixed(0)}%</td>
                      <td className={`py-2 text-right font-mono ${m.netPnl >= 0 ? "text-bull" : "text-bear"}`}>
                        {formatCurrency(m.netPnl, currency)}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "∞"}
                      </td>
                      <td className={`py-2 text-right font-mono ${m.expectancy >= 0 ? "text-bull" : "text-bear"}`}>
                        {formatCurrency(m.expectancy, currency)}
                      </td>
                      <td className="py-2 text-right">
                        {s.isArchived ? <span className="badge-muted">archived</span> : <span className="badge-info">active</span>}
                      </td>
                      <td className="py-2 text-right">
                        <form action={s.isArchived ? unarchiveStrategy : archiveStrategy}>
                          <input type="hidden" name="id" value={s.id} />
                          <button className="text-xs text-ink-muted hover:text-ink">
                            {s.isArchived ? "Restore" : "Archive"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="New strategy">
        <form action={createStrategy} className="card grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name *">
            <input name="name" required placeholder="London Breakout, NY Reversal…" />
          </Field>
          <Field label="Color">
            <input name="color" type="color" defaultValue="#7cf5b6" className="h-9" />
          </Field>
          <Field label="Markets (comma-separated)">
            <input name="markets" placeholder="forex, indices" />
          </Field>
          <Field label="Timeframes">
            <input name="timeframes" placeholder="5m, 15m, 1h" />
          </Field>
          <Field label="Short description" full>
            <input name="description" />
          </Field>
          <Field label="Playbook (entry rules, invalidation, exits)" full>
            <textarea name="playbook" rows={4} />
          </Field>
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" className="btn-primary">Save strategy</button>
          </div>
        </form>
      </Section>
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
