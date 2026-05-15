// Yahoo Finance adapter — unofficial, but reliable for stocks and indices.
//
// We use the chart endpoint because it accepts requests from any IP without
// the cookie/crumb dance the quote endpoint requires. We pull a 1-day range
// so we get the previous close in the same response.
//
// IMPORTANT: Yahoo throttles aggressive scraping. We fetch one symbol per
// request and rely on Next.js fetch caching to avoid re-pulling within 60s.

import type { Quote } from "./types";
import { normalizeSymbol } from "./normalize";

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

type YahooChartResponse = {
  chart: {
    result?: Array<{
      meta: {
        symbol: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        currency?: string;
        regularMarketTime?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
      };
    }>;
    error?: { code: string; description: string } | null;
  };
};

async function fetchOne(yahooSymbol: string, assetType: "stock" | "index"): Promise<Quote | null> {
  const url = `${BASE}/${encodeURIComponent(yahooSymbol)}?range=1d&interval=1d&includePrePost=false`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 },
      headers: {
        Accept: "application/json",
        // Yahoo serves richer payloads to a browser-y UA than to plain curl.
        "User-Agent":
          "Mozilla/5.0 (compatible; EdgecraftAI/0.2; +https://github.com/Trigii/Edgecraft-AI)",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as YahooChartResponse;
    const r = data.chart.result?.[0];
    if (!r) return null;
    const m = r.meta;
    if (m.regularMarketPrice == null) return null;
    const prev = m.chartPreviousClose ?? m.previousClose;
    const change = prev != null ? m.regularMarketPrice - prev : undefined;
    const changePct = prev != null && prev > 0 ? (change! / prev) * 100 : undefined;
    return {
      symbol: normalizeSymbol(yahooSymbol.replace(/^\^/, "")),
      assetType,
      price: m.regularMarketPrice,
      prevClose: prev,
      change24h: change,
      changePct24h: changePct,
      high24h: m.regularMarketDayHigh,
      low24h: m.regularMarketDayLow,
      asOf: m.regularMarketTime ? new Date(m.regularMarketTime * 1000) : new Date(),
      source: "yahoo",
      currency: m.currency,
    };
  } catch {
    return null;
  }
}

export async function fetchYahooQuotes(
  requests: { symbol: string; yahooSymbol: string; assetType: "stock" | "index" }[],
): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  await Promise.all(
    requests.map(async (r) => {
      const q = await fetchOne(r.yahooSymbol, r.assetType);
      if (q) out.set(normalizeSymbol(r.symbol), { ...q, symbol: normalizeSymbol(r.symbol) });
    }),
  );
  return out;
}
