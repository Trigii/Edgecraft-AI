import { cn, formatNumber } from "@/lib/utils";
import type { Quote } from "@/lib/market/types";
import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";

export function QuoteCard({
  symbol,
  quote,
  trades,
  href,
}: {
  symbol: string;
  quote: Quote | undefined;
  trades?: number;
  href?: string;
}) {
  const positive = (quote?.changePct24h ?? 0) > 0;
  const negative = (quote?.changePct24h ?? 0) < 0;
  const tone = positive ? "text-bull" : negative ? "text-bear" : "text-ink-muted";

  const inner = (
    <div className="card-tight h-full">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-medium">{symbol}</div>
        {quote && (
          <span className="text-[10px] uppercase tracking-widest text-ink-subtle">
            {quote.assetType}
          </span>
        )}
      </div>
      {quote ? (
        <>
          <div className="font-mono text-xl mt-1">
            {formatNumber(quote.price, { maximumFractionDigits: priceDigits(quote.price) })}
          </div>
          <div className={cn("flex items-center gap-1 text-xs mt-0.5", tone)}>
            {positive && <TrendingUp size={12} />}
            {negative && <TrendingDown size={12} />}
            <span>
              {quote.changePct24h != null ? `${quote.changePct24h.toFixed(2)}%` : "—"}
              {quote.change24h != null && (
                <span className="ml-1 text-ink-subtle">
                  ({quote.change24h >= 0 ? "+" : ""}
                  {formatNumber(quote.change24h, { maximumFractionDigits: priceDigits(quote.price) })})
                </span>
              )}
            </span>
          </div>
          <div className="text-[10px] text-ink-subtle mt-1">
            {trades != null && `${trades} trade${trades === 1 ? "" : "s"} · `}
            {quote.source}
          </div>
        </>
      ) : (
        <>
          <div className="font-mono text-xl mt-1 text-ink-subtle">—</div>
          <div className="text-[10px] text-ink-subtle mt-1">no quote available</div>
        </>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:opacity-90 transition-opacity">
        {inner}
      </Link>
    );
  }
  return inner;
}

function priceDigits(price: number) {
  if (price < 1) return 6;
  if (price < 10) return 4;
  if (price < 1000) return 2;
  return 2;
}
