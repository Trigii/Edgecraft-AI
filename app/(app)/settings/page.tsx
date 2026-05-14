import { Section } from "@/components/ui/section";
import { getDefaultUser, getAllAccounts } from "@/lib/queries";
import { updateSettings, createAccount, setActiveAccount } from "@/app/actions/settings";
import { isAiEnabled } from "@/lib/ai/copilot";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getDefaultUser();
  const accounts = await getAllAccounts(user.id);
  const s = user.settings!;

  return (
    <div className="space-y-6 max-w-3xl">
      <Section title="Risk rules" subtitle="The numbers the pre-trade copilot enforces. Conservative defaults are recommended for beginners.">
        <form action={updateSettings} className="card grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Base currency">
            <input name="baseCurrency" defaultValue={s.baseCurrency} />
          </Field>
          <Field label="Default timezone">
            <input name="defaultTimezone" defaultValue={s.defaultTimezone} />
          </Field>
          <Field label="Risk per trade (%)">
            <input name="riskPerTradePct" type="number" step="0.1" defaultValue={s.riskPerTradePct} />
          </Field>
          <Field label="Max daily loss (%)">
            <input name="maxDailyLossPct" type="number" step="0.1" defaultValue={s.maxDailyLossPct} />
          </Field>
          <Field label="Max concurrent open trades">
            <input name="maxOpenTrades" type="number" defaultValue={s.maxOpenTrades} />
          </Field>
          <Field label="Minimum R:R (block trades below this)">
            <input name="minRiskReward" type="number" step="0.1" defaultValue={s.minRiskReward} />
          </Field>
          <Field label="Overtrading threshold (trades/day)">
            <input name="overtradingThreshold" type="number" defaultValue={s.overtradingThreshold} />
          </Field>
          <div className="flex flex-col gap-2 justify-center">
            <Checkbox name="enforcePreTradeChecklist" label="Enforce pre-trade checklist" defaultChecked={s.enforcePreTradeChecklist} />
            <Checkbox name="tiltDetectionEnabled" label="Detect tilt (consecutive losses)" defaultChecked={s.tiltDetectionEnabled} />
            <Checkbox name="aiEnabled" label="Enable AI copilot (requires API key)" defaultChecked={s.aiEnabled} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" className="btn-primary">Save settings</button>
          </div>
        </form>
      </Section>

      <Section title="Accounts" subtitle="One account = one broker connection. Switch between them at the top.">
        <div className="card">
          {accounts.length === 0 && (
            <p className="text-sm text-ink-muted">No accounts yet — create your first below.</p>
          )}
          {accounts.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-ink-subtle text-left">
                <tr>
                  <th className="py-2 font-normal">Name</th>
                  <th className="py-2 font-normal">Broker</th>
                  <th className="py-2 font-normal">Type</th>
                  <th className="py-2 font-normal text-right">Initial balance</th>
                  <th className="py-2 font-normal text-right">Currency</th>
                  <th className="py-2 font-normal" />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-t border-bg-border">
                    <td className="py-2 font-medium">{a.name}</td>
                    <td className="py-2 text-ink-muted">{a.broker ?? "—"}</td>
                    <td className="py-2">
                      <span className="badge-muted">{a.accountType}</span>
                    </td>
                    <td className="py-2 text-right font-mono">{a.initialBalance.toFixed(2)}</td>
                    <td className="py-2 text-right">{a.currency}</td>
                    <td className="py-2 text-right">
                      {a.isActive ? (
                        <span className="badge-info">active</span>
                      ) : (
                        <form action={setActiveAccount}>
                          <input type="hidden" name="id" value={a.id} />
                          <button className="text-xs link">Set active</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      <Section title="New account">
        <form action={createAccount} className="card grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name *"><input name="name" required placeholder="Binance Spot" /></Field>
          <Field label="Broker"><input name="broker" placeholder="Binance, IBKR, MT5…" /></Field>
          <Field label="Account type">
            <select name="accountType" defaultValue="live">
              <option value="demo">demo</option>
              <option value="paper">paper</option>
              <option value="live">live</option>
              <option value="prop">prop firm</option>
            </select>
          </Field>
          <Field label="Asset focus">
            <select name="assetFocus" defaultValue="mixed">
              <option value="forex">forex</option>
              <option value="stocks">stocks</option>
              <option value="crypto">crypto</option>
              <option value="futures">futures</option>
              <option value="mixed">mixed</option>
            </select>
          </Field>
          <Field label="Currency"><input name="currency" defaultValue="USD" /></Field>
          <Field label="Initial balance"><input name="initialBalance" type="number" step="any" defaultValue={10000} /></Field>
          <Field label="Leverage"><input name="leverage" type="number" step="any" defaultValue={1} /></Field>
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" className="btn-primary">Create account</button>
          </div>
        </form>
      </Section>

      <Section title="AI copilot" subtitle="Optional. The product is fully functional without it.">
        <div className="card text-sm space-y-2">
          {isAiEnabled() ? (
            <p className="text-bull">ANTHROPIC_API_KEY detected — AI features active.</p>
          ) : (
            <p className="text-ink-muted">
              Set <code className="text-edge">ANTHROPIC_API_KEY</code> in <code>.env.local</code> to unlock the AI weekly review, post-mortems, and natural-language Q&A about your performance.
            </p>
          )}
          <p className="text-ink-subtle text-xs">
            The AI is grounded on your stats — never raw price data — and is instructed never to recommend entries/exits.
          </p>
        </div>
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

function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="w-4 h-4" />
      {label}
    </label>
  );
}
