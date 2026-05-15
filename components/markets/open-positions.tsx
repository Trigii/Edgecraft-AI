import { getQuotes, normalizeSymbol, unrealizedPnl } from "@/lib/market";
import { prisma } from "@/lib/db";
import { formatCurrency, cn } from "@/lib/utils";
import Link from "next/link";
import { Section } from "@/components/ui/section";

// Live P&L block. Server component — fetches quotes inside the request.
// Refreshes on page reload (revalidate set on the parent page).
export async function OpenPositions({
  accountId,
  currency,
}: {
  accountId: string;
  currency: string;
}) {
  const open = await prisma.trade.findMany({
    where: { accountId, status: "open" },
    orderBy: { openedAt: "desc" },
    include: { strategy: true },
  });

  if (open.length === 0) {
    return (
      <Section title="Open positions" subtitle="No trades currently open.">
        <div className="card-tight text-sm text-ink-muted">
          <Link href="/copilot" className="link">Run the pre-trade copilot</Link>{" "}
          before opening your next position.
        </div>
      </Section>
    );
  }

  const quotes = await getQuotes(
    open.map((t) => ({ symbol: t.symbol, assetType: t.assetType })),
  );

  // Compute unrealized P&L per position + roll-up
  const rows = open.map((t) => {
    const q = quotes.get(normalizeSymbol(t.symbol));
    const pnl = q
      ? unrealizedPnl({
          direction: t.direction,
          entryPrice: t.entryPrice,
          size: t.size,
          fees: t.fees,
          swap: t.swap,
          currentPrice: q.price,
        })
      : null;
    const riskAmt =
      t.stopLoss != null
        ? Math.max(0, (t.direction === "short" ? t.stopLoss - t.entryPrice : t.entryPrice - t.stopLoss) * t.size)
        : 0;
    const rMultiple = riskAmt > 0 && pnl != null ? pnl / riskAmt : null;
    const pctToStop =
      q && t.stopLoss != null
        ? distanceToStopPct({
            direction: t.direction,
            current: q.price,
            entry: t.entryPrice,
            stop: t.stopLoss,
          })
        : null;
    return { trade: t, quote: q, pnl, rMultiple, pctToStop };
  });

  const totalUnrealized = rows.reduce((a, r) => a + (r.pnl ?? 0), 0);

  return (
    <Section
      title="Open positions"
      subtitle={`${open.length} open · live prices, refresh page for an update`}
      action={
        <div
          className={cn(
            "font-mono text-sm",
            totalUnrealized > 0 ? "text-bull" : totalUnrealized < 0 ? "text-bear" : "text-ink",
          )}
        >
          {totalUnrealized >= 0 ? "+" : ""}
          {formatCurrency(totalUnrealized, currency)}
        </div>
      }
    >
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-ink-subtle text-left">
            <tr>
              <th className="py-2 font-normal">Symbol</th>
              <th className="py-2 font-normal">Side</th>
              <th className="py-2 font-normal text-right">Size</th>
              <th className="py-2 font-normal text-right">Entry</th>
              <th className="py-2 font-normal text-right">Now</th>
              <th className="py-2 font-normal text-right">SL distance</th>
              <th className="py-2 font-normal text-right">Unrealized R</th>
              <th className="py-2 font-normal text-right">Unrealized P&L</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ trade: t, quote, pnl, rMultiple, pctToStop }) => (
              <tr key={t.id} className="border-t border-bg-border">
                <td className="py-2">
                  <Link href={`/journal/${t.id}`} className="link font-medium">
                    {t.symbol}
                  </Link>
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
                <td className="py-2 text-right font-mono">
                  {quote ? quote.price.toFixed(5) : <span className="text-ink-subtle">—</span>}
                </td>
                <td className="py-2 text-right font-mono">
                  {pctToStop != null ? (
                    <span
                      className={cn(
                        pctToStop < 25 ? "text-bear" : pctToStop < 50 ? "text-warn" : "text-ink-muted",
                      )}
                    >
                      {pctToStop.toFixed(0)}% to SL
                    </span>
                  ) : (
                    <span className="text-ink-subtle">no SL</span>
                  )}
                </td>
                <td className={cn(
                  "py-2 text-right font-mono",
                  rMultiple == null ? "" : rMultiple >= 0 ? "text-bull" : "text-bear",
                )}>
                  {rMultiple != null ? `${rMultiple >= 0 ? "+" : ""}${rMultiple.toFixed(2)}R` : "—"}
                </td>
                <td className={cn(
                  "py-2 text-right font-mono",
                  pnl == null ? "" : pnl >= 0 ? "text-bull" : "text-bear",
                )}>
                  {pnl != null ? `${pnl >= 0 ? "+" : ""}${formatCurrency(pnl, currency)}` : "—"}
                </td>
                <td className="py-2 text-right">
                  <Link href={`/journal/${t.id}`} className="text-xs text-ink-muted hover:text-ink">
                    open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// 0% = right at stop (next tick stops out)
// 100% = right at entry (full room before stop is touched)
function distanceToStopPct({
  direction,
  current,
  entry,
  stop,
}: {
  direction: string;
  current: number;
  entry: number;
  stop: number;
}) {
  const totalRoom = Math.abs(entry - stop);
  if (totalRoom === 0) return 0;
  const remaining =
    direction === "short" ? Math.max(0, stop - current) : Math.max(0, current - stop);
  return Math.min(100, (remaining / totalRoom) * 100);
}
