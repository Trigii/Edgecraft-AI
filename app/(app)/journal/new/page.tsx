import { prisma } from "@/lib/db";
import { getDefaultUser, getActiveAccount } from "@/lib/queries";
import { createTrade } from "@/app/actions/trades";
import { Section } from "@/components/ui/section";
import { Empty } from "@/components/ui/empty";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewTrade() {
  const user = await getDefaultUser();
  const account = await getActiveAccount(user.id);
  if (!account) {
    return (
      <Empty
        title="Create an account first"
        action={<Link className="btn-primary" href="/settings">Settings</Link>}
      />
    );
  }
  const strategies = await prisma.strategy.findMany({
    where: { userId: user.id, isArchived: false },
    orderBy: { name: "asc" },
  });

  const nowLocal = new Date().toISOString().slice(0, 16);

  return (
    <Section title="Log a trade" subtitle="Closed and open trades both belong here. Fill what you have.">
      <form action={createTrade} className="card grid grid-cols-1 md:grid-cols-2 gap-4">
        <input type="hidden" name="accountId" value={account.id} />

        <Field label="Symbol *">
          <input name="symbol" required placeholder="EURUSD, AAPL, BTCUSDT" />
        </Field>
        <Field label="Asset type">
          <select name="assetType" defaultValue="forex">
            <option value="forex">forex</option>
            <option value="stock">stock</option>
            <option value="crypto">crypto</option>
            <option value="future">future</option>
            <option value="option">option</option>
            <option value="index">index</option>
          </select>
        </Field>

        <Field label="Direction *">
          <select name="direction" required>
            <option value="long">long</option>
            <option value="short">short</option>
          </select>
        </Field>
        <Field label="Size *">
          <input name="size" type="number" step="any" required />
        </Field>

        <Field label="Entry price *">
          <input name="entryPrice" type="number" step="any" required />
        </Field>
        <Field label="Stop loss">
          <input name="stopLoss" type="number" step="any" />
        </Field>

        <Field label="Take profit">
          <input name="takeProfit" type="number" step="any" />
        </Field>
        <Field label="Exit price (if closed)">
          <input name="exitPrice" type="number" step="any" />
        </Field>

        <Field label="Opened at *">
          <input name="openedAt" type="datetime-local" defaultValue={nowLocal} required />
        </Field>
        <Field label="Closed at (if closed)">
          <input name="closedAt" type="datetime-local" />
        </Field>

        <Field label="Fees">
          <input name="fees" type="number" step="any" defaultValue={0} />
        </Field>
        <Field label="Swap / financing">
          <input name="swap" type="number" step="any" defaultValue={0} />
        </Field>

        <Field label="Strategy">
          <select name="strategyId" defaultValue="">
            <option value="">— none —</option>
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tags (comma-separated)">
          <input name="tags" placeholder="news-driven, breakout, london-session" />
        </Field>

        <Field label="Pre-trade emotion">
          <select name="emotionPre" defaultValue="">
            <option value="">—</option>
            <option value="calm">calm</option>
            <option value="confident">confident</option>
            <option value="uncertain">uncertain</option>
            <option value="fomo">FOMO</option>
            <option value="revenge">revenge</option>
          </select>
        </Field>
        <Field label="Confidence (1-10)">
          <input name="confidencePre" type="number" min={1} max={10} />
        </Field>

        <Field label="Thesis — why are you taking this trade?" full>
          <textarea name="thesis" rows={3} placeholder="Setup, levels, invalidation, expected behavior…" />
        </Field>

        <Field label="Notes" full>
          <textarea name="notes" rows={3} />
        </Field>

        <div className="md:col-span-2 flex items-center justify-end gap-2">
          <Link href="/journal" className="btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn-primary">
            Save trade
          </button>
        </div>
      </form>
    </Section>
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
