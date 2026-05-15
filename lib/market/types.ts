// Normalized market quote. Every provider adapter returns this shape.
// Fields are optional because not every source exposes them.

export type Quote = {
  symbol: string;                    // normalized: EURUSD, BTCUSDT, AAPL
  assetType: "forex" | "crypto" | "stock" | "index" | "future" | "option" | "unknown";
  price: number;
  prevClose?: number;
  change24h?: number;                // absolute, in quote currency
  changePct24h?: number;             // %
  high24h?: number;
  low24h?: number;
  asOf: Date;
  source: string;                    // "coingecko" | "frankfurter" | "yahoo"
  currency?: string;                 // USD, USDT, EUR…
};

export type QuoteResult =
  | { ok: true; quote: Quote }
  | { ok: false; symbol: string; error: string };
