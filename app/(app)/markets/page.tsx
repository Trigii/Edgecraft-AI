import { Section } from "@/components/ui/section";
import { QuoteCard } from "@/components/markets/quote-card";
import { Empty } from "@/components/ui/empty";
import { getDefaultUser, getActiveAccount } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { getQuotes, normalizeSymbol } from "@/lib/market";
import Link from "next/link";
import { TrendingUp, TrendingDown, Globe2 } from "lucide-react";

// The Markets page is a server component. Quotes are fetched at request time
// and Next.js fetch caching avoids hitting upstream APIs more than once per
// 60s. Crypto + FX + stocks are fanned out in parallel inside getQuotes.
export const revalidate = 60;

const WATCHLIST_DEFAULTS: { symbol: string; assetType: string }[] = [
  { symbol: "EURUSD", assetType: "forex" },
  { symbol: "GBPUSD", assetType: "forex" },
  { symbol: "USDJPY", assetType: "forex" },
  { symbol: "BTCUSDT", assetType: "crypto" },
  { symbol: "ETHUSD", assetType: "crypto" },
  { symbol: "SPY", assetType: "index" },
  { symbol: "AAPL", assetType: "stock" },
  { symbol: "TSLA", assetType: "stock" },
];

export default async function MarketsPage() {
  const user = await getDefaultUser();
  const account = await getActiveAccount(user.id);

  // What symbols has the trader traded? Join the watchlist defaults to make
  // a first-time user see something useful even with zero history.
  const traded = account
    ? await prisma.trade.groupBy({
        by: ["symbol", "assetType"],
        where: { accountId: account.id },
        _count: { _all: true },
        orderBy: { _count: { symbol: "desc" } },
      })
    : [];

  const tradedSet = new Set(traded.map((t) => normalizeSymbol(t.symbol)));
  const allSymbols = [
    ...traded.map((t) => ({ symbol: t.symbol, assetType: t.assetType, trades: t._count._all })),
    ...WATCHLIST_DEFAULTS
      .filter((w) => !tradedSet.has(normalizeSymbol(w.symbol)))
      .map((w) => ({ symbol: w.symbol, assetType: w.assetType, trades: 0 })),
  ];

  const quotes = await getQuotes(
    allSymbols.map((s) => ({ symbol: s.symbol, assetType: s.assetType })),
  );

  const enriched = allSymbols.map((s) => ({
    ...s,
    quote: quotes.get(normalizeSymbol(s.symbol)),
  }));

  // Movers: biggest +/- 24h move (only quotes we actually have)
  const withQuotes = enriched.filter((e) => e.quote && e.quote.changePct24h != null);
  const gainers = [...withQuotes]
    .sort((a, b) => (b.quote!.changePct24h ?? 0) - (a.quote!.changePct24h ?? 0))
    .slice(0, 3);
  const losers = [...withQuotes]
    .sort((a, b) => (a.quote!.changePct24h ?? 0) - (b.quote!.changePct24h ?? 0))
    .slice(0, 3);

  // Group by asset type for the main grid
  const grouped = {
    forex: enriched.filter((e) => normalize(e.assetType) === "forex"),
    crypto: enriched.filter((e) => normalize(e.assetType) === "crypto"),
    stocks: enriched.filter((e) => ["stock", "index"].includes(normalize(e.assetType))),
    other: enriched.filter((e) => !["forex", "crypto", "stock", "index"].includes(normalize(e.assetType))),
  };

  return (
    <div className="space-y-6">
      <Section
        title="Markets"
        subtitle="Live prices for what you trade. Crypto via CoinGecko, FX via ECB (Frankfurter), stocks via Yahoo Finance. Cached 60s."
        action={
          <span className="text-xs text-ink-subtle inline-flex items-center gap-1">
            <Globe2 size={12} /> {new Date().toUTCString().slice(-12, -4)} UTC
          </span>
        }
      >
        {withQuotes.length === 0 ? (
          <Empty
            title="No quotes available"
            subtitle="Either the providers are unreachable, or your symbols aren't recognized yet. You can still log trades; pricing is best-effort."
            action={
              <Link href="/journal/new" className="btn-primary">
                Log a trade
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {gainers.length > 0 && (
              <div className="card border-bull/30 col-span-2 md:col-span-3">
                <div className="flex items-center gap-2 text-bull text-sm mb-2">
                  <TrendingUp size={14} /> Top movers (24h)
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  {gainers.map((e) => (
                    <QuoteCard key={e.symbol + "g"} symbol={e.symbol} quote={e.quote} trades={e.trades} />
                  ))}
                  {losers.map((e) => (
                    <QuoteCard key={e.symbol + "l"} symbol={e.symbol} quote={e.quote} trades={e.trades} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {(["forex", "crypto", "stocks"] as const).map((bucket) => {
        const items = grouped[bucket];
        if (items.length === 0) return null;
        const title =
          bucket === "forex" ? "Forex" : bucket === "crypto" ? "Crypto" : "Stocks & indices";
        return (
          <Section key={bucket} title={title} subtitle={`${items.length} symbol${items.length === 1 ? "" : "s"}`}>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {items.map((e) => (
                <QuoteCard
                  key={e.symbol}
                  symbol={e.symbol}
                  quote={e.quote}
                  trades={e.trades}
                  href={`/journal?symbol=${encodeURIComponent(e.symbol)}`}
                />
              ))}
            </div>
          </Section>
        );
      })}

      <p className="text-xs text-ink-subtle">
        FX prices are end-of-day ECB rates (no intraday tick data without a paid provider).
        Crypto & stock quotes are near real-time. Edgecraft does not place trades — quotes are for
        journaling and education only.
      </p>
    </div>
  );
}

function normalize(s: string) {
  return s?.toLowerCase?.();
}
