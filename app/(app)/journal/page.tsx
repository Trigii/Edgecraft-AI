import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDefaultUser, getActiveAccount } from "@/lib/queries";
import { Section } from "@/components/ui/section";
import { Empty } from "@/components/ui/empty";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function JournalIndex({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; symbol?: string; outcome?: string }>;
}) {
  const sp = await searchParams;
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

  const trades = await prisma.trade.findMany({
    where: {
      accountId: account.id,
      status: sp.status || undefined,
      symbol: sp.symbol ? { contains: sp.symbol.toUpperCase() } : undefined,
      outcome: sp.outcome || undefined,
    },
    orderBy: { openedAt: "desc" },
    take: 200,
    include: { strategy: true },
  });

  const symbols = await prisma.trade.findMany({
    where: { accountId: account.id },
    distinct: ["symbol"],
    select: { symbol: true },
  });

  return (
    <Section
      title="Journal"
      subtitle={`${trades.length} trades`}
      action={
        <Link href="/journal/new" className="btn-primary text-sm">
          + Log a trade
        </Link>
      }
    >
      <div className="card-tight flex flex-wrap items-center gap-2 text-sm">
        <Filter param="status" current={sp.status} options={["", "open", "closed", "cancelled"]} />
        <Filter param="outcome" current={sp.outcome} options={["", "win", "loss", "breakeven"]} />
        <SymbolFilter symbols={symbols.map((s) => s.symbol)} current={sp.symbol} />
        {(sp.status || sp.outcome || sp.symbol) && (
          <Link href="/journal" className="text-xs text-ink-muted hover:text-ink ml-auto">
            Clear
          </Link>
        )}
      </div>

      {trades.length === 0 ? (
        <Empty
          title="No trades match"
          action={<Link className="btn-primary" href="/journal/new">Log a trade</Link>}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-ink-subtle text-left">
              <tr>
                <th className="py-2 font-normal">Symbol</th>
                <th className="py-2 font-normal">Side</th>
                <th className="py-2 font-normal text-right">Size</th>
                <th className="py-2 font-normal text-right">Entry</th>
                <th className="py-2 font-normal text-right">Exit</th>
                <th className="py-2 font-normal text-right">R</th>
                <th className="py-2 font-normal text-right">P&L</th>
                <th className="py-2 font-normal">Strategy</th>
                <th className="py-2 font-normal">Opened</th>
                <th className="py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-t border-bg-border hover:bg-bg-elevated/40">
                  <td className="py-2">
                    <Link href={`/journal/${t.id}`} className="link font-medium">
                      {t.symbol}
                    </Link>
                    <span className="ml-1 text-xs text-ink-subtle">{t.assetType}</span>
                  </td>
                  <td className="py-2">
                    {t.direction === "long" ? (
                      <span className="badge-bull">LONG</span>
                    ) : (
                      <span className="badge-bear">SHORT</span>
                    )}
                  </td>
                  <td className="py-2 text-right font-mono">{t.size}</td>
                  <td className="py-2 text-right font-mono">{t.entryPrice.toFixed(5)}</td>
                  <td className="py-2 text-right font-mono">{t.exitPrice?.toFixed(5) ?? "—"}</td>
                  <td className="py-2 text-right font-mono">
                    {t.rMultiple != null ? `${t.rMultiple.toFixed(2)}R` : "—"}
                  </td>
                  <td
                    className={`py-2 text-right font-mono ${
                      t.pnl == null ? "" : t.pnl >= 0 ? "text-bull" : "text-bear"
                    }`}
                  >
                    {t.pnl != null ? formatCurrency(t.pnl, account.currency) : "—"}
                  </td>
                  <td className="py-2 text-ink-muted">{t.strategy?.name ?? "—"}</td>
                  <td className="py-2 text-ink-muted text-xs whitespace-nowrap">
                    {t.openedAt.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="py-2">
                    {t.status === "open" ? (
                      <span className="badge-warn">open</span>
                    ) : t.status === "closed" ? (
                      <span className="badge-muted">closed</span>
                    ) : (
                      <span className="badge-muted">{t.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function Filter({ param, current, options }: { param: string; current?: string; options: string[] }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-ink-subtle uppercase tracking-wider mr-1">{param}:</span>
      {options.map((opt) => {
        const isActive = (current ?? "") === opt;
        const label = opt || "all";
        const search = new URLSearchParams();
        if (opt) search.set(param, opt);
        return (
          <Link
            key={opt || "all"}
            href={`/journal?${search.toString()}`}
            className={`px-2 py-0.5 rounded text-xs ${
              isActive ? "bg-edge text-bg" : "text-ink-muted hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

function SymbolFilter({ symbols, current }: { symbols: string[]; current?: string }) {
  return (
    <form className="flex items-center gap-1" action="/journal">
      <input
        name="symbol"
        defaultValue={current ?? ""}
        placeholder="symbol…"
        list="symbols"
        className="text-xs py-1 px-2"
      />
      <datalist id="symbols">
        {symbols.map((s) => <option key={s} value={s} />)}
      </datalist>
    </form>
  );
}
