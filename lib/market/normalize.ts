// Symbol normalization & routing.
//
// Traders write symbols every which way: "EURUSD", "EUR/USD", "EUR-USD",
// "BTCUSDT", "BTC-USD", "BTC/USDT". We collapse them all to a canonical
// form and decide which provider can resolve them.

import type { Quote } from "./types";

// Known crypto IDs. We hard-code the common ones; less popular tickers will
// fall back to CoinGecko's search endpoint.
export const CRYPTO_IDS: Record<string, { id: string; quote: string }> = {
  BTC: { id: "bitcoin", quote: "USD" },
  BTCUSD: { id: "bitcoin", quote: "USD" },
  BTCUSDT: { id: "bitcoin", quote: "USDT" },
  XBT: { id: "bitcoin", quote: "USD" },
  ETH: { id: "ethereum", quote: "USD" },
  ETHUSD: { id: "ethereum", quote: "USD" },
  ETHUSDT: { id: "ethereum", quote: "USDT" },
  SOL: { id: "solana", quote: "USD" },
  SOLUSD: { id: "solana", quote: "USD" },
  SOLUSDT: { id: "solana", quote: "USDT" },
  BNB: { id: "binancecoin", quote: "USD" },
  BNBUSDT: { id: "binancecoin", quote: "USDT" },
  XRP: { id: "ripple", quote: "USD" },
  XRPUSDT: { id: "ripple", quote: "USDT" },
  ADA: { id: "cardano", quote: "USD" },
  DOGE: { id: "dogecoin", quote: "USD" },
  AVAX: { id: "avalanche-2", quote: "USD" },
  LINK: { id: "chainlink", quote: "USD" },
  MATIC: { id: "matic-network", quote: "USD" },
  DOT: { id: "polkadot", quote: "USD" },
  UNI: { id: "uniswap", quote: "USD" },
  LTC: { id: "litecoin", quote: "USD" },
};

const FX_CURRENCIES = new Set([
  "EUR", "USD", "GBP", "JPY", "CHF", "AUD", "NZD", "CAD",
  "SEK", "NOK", "DKK", "PLN", "MXN", "TRY", "ZAR", "CNH",
  "HKD", "SGD", "HUF", "CZK", "INR", "BRL",
]);

// Common indices — Yahoo prefixes them with ^
const INDEX_MAP: Record<string, string> = {
  SPX: "^GSPC", SPY: "SPY",
  NDX: "^NDX", QQQ: "QQQ",
  DJI: "^DJI",
  RUT: "^RUT",
  VIX: "^VIX",
  DAX: "^GDAXI",
  FTSE: "^FTSE",
  N225: "^N225",
};

export function normalizeSymbol(input: string): string {
  return input.trim().toUpperCase().replace(/[\s/\-_]/g, "");
}

export type Routing =
  | { kind: "fx"; from: string; to: string; assetType: "forex" }
  | { kind: "crypto"; coingeckoId: string; vs: string; assetType: "crypto" }
  | { kind: "yahoo"; yahooSymbol: string; assetType: "stock" | "index" }
  | { kind: "unknown"; assetType: "unknown" };

export function routeSymbol(rawSymbol: string, assetTypeHint?: string): Routing {
  const s = normalizeSymbol(rawSymbol);
  if (!s) return { kind: "unknown", assetType: "unknown" };

  // 1. Hard-coded crypto matches first (covers things like ETH that would
  //    otherwise look like FX-prefix tokens).
  const cryptoExact = CRYPTO_IDS[s];
  if (cryptoExact) {
    return {
      kind: "crypto",
      coingeckoId: cryptoExact.id,
      vs: cryptoExact.quote === "USDT" ? "usd" : cryptoExact.quote.toLowerCase(),
      assetType: "crypto",
    };
  }

  // 2. FX pair detection: two 3-letter ISO currencies, possibly suffixed with
  //    stable suffixes already handled. Six chars total.
  if (s.length === 6) {
    const from = s.slice(0, 3);
    const to = s.slice(3, 6);
    if (FX_CURRENCIES.has(from) && FX_CURRENCIES.has(to)) {
      return { kind: "fx", from, to, assetType: "forex" };
    }
  }

  // 3. Crypto pairs encoded as <BASE><USDT|USD|EUR>.
  if (assetTypeHint === "crypto" || /USDT$|USDC$|USD$/.test(s)) {
    for (const suffix of ["USDT", "USDC", "USD", "EUR"]) {
      if (s.endsWith(suffix) && s.length > suffix.length) {
        const base = s.slice(0, -suffix.length);
        const known = CRYPTO_IDS[base] ?? CRYPTO_IDS[base + "USD"];
        if (known) {
          return {
            kind: "crypto",
            coingeckoId: known.id,
            vs: suffix === "USDT" || suffix === "USDC" ? "usd" : suffix.toLowerCase(),
            assetType: "crypto",
          };
        }
      }
    }
  }

  // 4. Index alias?
  if (INDEX_MAP[s]) {
    return { kind: "yahoo", yahooSymbol: INDEX_MAP[s], assetType: "index" };
  }

  // 5. Fall back to Yahoo for everything else (mostly stocks).
  return { kind: "yahoo", yahooSymbol: s, assetType: "stock" };
}

// Helper for building a "presentation" quote when we have a routing but
// the network call fails. Keeps the UI honest about what we know.
export function unknownQuote(symbol: string, error: string): Quote {
  return {
    symbol: normalizeSymbol(symbol),
    assetType: "unknown",
    price: 0,
    asOf: new Date(),
    source: `error:${error}`,
  };
}
