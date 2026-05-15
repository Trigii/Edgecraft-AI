// Unified market data facade.
//
// Callers ask for quotes by symbol; the facade decides which adapter to use
// per symbol, fans out in parallel, and returns a Map keyed by normalized
// symbol. Missing quotes return undefined — the UI handles the empty state.
//
// Caching: each underlying adapter uses Next.js `fetch` cache with revalidate.
// This means a dashboard render with 8 symbols never hits the network more
// than once per cache window (60s for crypto/stocks, 5min for FX).

import { normalizeSymbol, routeSymbol } from "./normalize";
import { fetchCoinGeckoQuotes } from "./coingecko";
import { fetchFrankfurterQuotes } from "./frankfurter";
import { fetchYahooQuotes } from "./yahoo";
import type { Quote } from "./types";

export type { Quote } from "./types";
export { normalizeSymbol, routeSymbol } from "./normalize";

export async function getQuotes(
  symbols: { symbol: string; assetType?: string }[],
): Promise<Map<string, Quote>> {
  const cryptoReqs: Parameters<typeof fetchCoinGeckoQuotes>[0] = [];
  const fxReqs: Parameters<typeof fetchFrankfurterQuotes>[0] = [];
  const yahooReqs: Parameters<typeof fetchYahooQuotes>[0] = [];

  for (const s of symbols) {
    const r = routeSymbol(s.symbol, s.assetType);
    switch (r.kind) {
      case "crypto":
        cryptoReqs.push({ symbol: s.symbol, coingeckoId: r.coingeckoId, vs: r.vs });
        break;
      case "fx":
        fxReqs.push({ symbol: s.symbol, from: r.from, to: r.to });
        break;
      case "yahoo":
        yahooReqs.push({ symbol: s.symbol, yahooSymbol: r.yahooSymbol, assetType: r.assetType });
        break;
    }
  }

  const [crypto, fx, yahoo] = await Promise.all([
    fetchCoinGeckoQuotes(cryptoReqs),
    fetchFrankfurterQuotes(fxReqs),
    fetchYahooQuotes(yahooReqs),
  ]);

  const merged = new Map<string, Quote>();
  for (const m of [crypto, fx, yahoo]) for (const [k, v] of m) merged.set(k, v);
  return merged;
}

export async function getQuote(symbol: string, assetType?: string): Promise<Quote | undefined> {
  const map = await getQuotes([{ symbol, assetType }]);
  return map.get(normalizeSymbol(symbol));
}

// Compute unrealized P&L for an open trade, given a live quote.
// Same math as analytics/metrics.ts/computeTradePnl but with the *current*
// price instead of the (yet unknown) exit price.
export function unrealizedPnl(args: {
  direction: string;
  entryPrice: number;
  size: number;
  fees?: number;
  swap?: number;
  currentPrice: number;
}) {
  const { direction, entryPrice, size, currentPrice, fees = 0, swap = 0 } = args;
  const delta = direction === "short" ? entryPrice - currentPrice : currentPrice - entryPrice;
  return delta * size - fees - swap;
}
