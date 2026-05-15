// Frankfurter adapter — free, no API key, official ECB rates.
//
// Limitation: end-of-day rates only (not tick data). Fine for journaling
// and computing approximate unrealized P&L on FX trades. Real intraday FX
// would need a paid provider; we surface the staleness in the quote.
//
// We compute change vs the previous business day with one extra call.

import type { Quote } from "./types";
import { normalizeSymbol } from "./normalize";

const BASE = "https://api.frankfurter.dev/v1";

type FrankResp = {
  base: string;
  date: string;
  rates: Record<string, number>;
};

async function fetchOnce(base: string, symbols: string[], date = "latest"): Promise<FrankResp | null> {
  if (symbols.length === 0) return null;
  const url = `${BASE}/${date}?base=${base}&symbols=${symbols.join(",")}`;
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as FrankResp;
  } catch {
    return null;
  }
}

export async function fetchFrankfurterQuotes(
  requests: { symbol: string; from: string; to: string }[],
): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  if (requests.length === 0) return out;

  // Group by `from` so we minimize API calls (one base per group).
  const byFrom = new Map<string, Set<string>>();
  for (const r of requests) {
    const set = byFrom.get(r.from) ?? new Set();
    set.add(r.to);
    byFrom.set(r.from, set);
  }

  // Yesterday's date for 24h delta. Frankfurter returns most-recent
  // business day if we ask for a non-trading date, which is exactly
  // what we want.
  const y = new Date();
  y.setUTCDate(y.getUTCDate() - 1);
  const yISO = y.toISOString().slice(0, 10);

  await Promise.all(
    Array.from(byFrom.entries()).map(async ([from, tos]) => {
      const symbols = Array.from(tos);
      const [latest, prev] = await Promise.all([
        fetchOnce(from, symbols, "latest"),
        fetchOnce(from, symbols, yISO),
      ]);
      if (!latest) return;

      for (const r of requests) {
        if (r.from !== from) continue;
        const price = latest.rates[r.to];
        if (price == null) continue;
        const prevPrice = prev?.rates?.[r.to];
        const changePct =
          prevPrice != null && prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : undefined;
        out.set(normalizeSymbol(r.symbol), {
          symbol: normalizeSymbol(r.symbol),
          assetType: "forex",
          price,
          prevClose: prevPrice,
          changePct24h: changePct,
          change24h: prevPrice != null ? price - prevPrice : undefined,
          asOf: new Date(latest.date),
          source: "frankfurter",
          currency: r.to,
        });
      }
    }),
  );

  return out;
}
