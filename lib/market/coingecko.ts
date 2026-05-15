// CoinGecko adapter — free, no API key, generous rate limits (50 req/min).
//
// Bulk endpoint: GET /simple/price?ids=bitcoin,ethereum&vs_currencies=usd
// We deduplicate ids across the batch so 50 BTC trades cost 1 request.

import type { Quote } from "./types";
import { normalizeSymbol } from "./normalize";

const BASE = "https://api.coingecko.com/api/v3";

type CGResponse = Record<
  string,
  { usd?: number; eur?: number; gbp?: number; usd_24h_change?: number; eur_24h_change?: number; gbp_24h_change?: number; last_updated_at?: number }
>;

export async function fetchCoinGeckoQuotes(
  requests: { symbol: string; coingeckoId: string; vs: string }[],
): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  if (requests.length === 0) return out;

  // Group by vs currency so each call returns the right fields.
  const byVs = new Map<string, string[]>();
  for (const r of requests) {
    const arr = byVs.get(r.vs) ?? [];
    if (!arr.includes(r.coingeckoId)) arr.push(r.coingeckoId);
    byVs.set(r.vs, arr);
  }

  await Promise.all(
    Array.from(byVs.entries()).map(async ([vs, ids]) => {
      const url =
        `${BASE}/simple/price?ids=${ids.join(",")}` +
        `&vs_currencies=${vs}&include_24hr_change=true&include_last_updated_at=true`;
      try {
        const res = await fetch(url, {
          next: { revalidate: 60 },
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as CGResponse;
        for (const r of requests) {
          if (r.vs !== vs) continue;
          const row = data[r.coingeckoId];
          if (!row) continue;
          const price = (row as Record<string, number | undefined>)[vs];
          const change = (row as Record<string, number | undefined>)[`${vs}_24h_change`];
          if (price == null) continue;
          out.set(normalizeSymbol(r.symbol), {
            symbol: normalizeSymbol(r.symbol),
            assetType: "crypto",
            price,
            changePct24h: change,
            asOf: row.last_updated_at ? new Date(row.last_updated_at * 1000) : new Date(),
            source: "coingecko",
            currency: vs.toUpperCase(),
          });
        }
      } catch {
        // network failure — leave the symbols missing; caller renders empty state
      }
    }),
  );

  return out;
}
