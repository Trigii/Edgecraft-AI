import { getQuotes, normalizeSymbol } from "@/lib/market";
import { prisma } from "@/lib/db";
import { QuoteCard } from "./quote-card";
import { Section } from "@/components/ui/section";
import Link from "next/link";

// Compact "markets" strip for the dashboard. Shows the symbols the trader
// touches most often, so a quick glance gives them current context for
// their PnL story.
export async function MarketsSnapshot({ accountId }: { accountId: string }) {
  const top = await prisma.trade.groupBy({
    by: ["symbol", "assetType"],
    where: { accountId },
    _count: { _all: true },
    orderBy: { _count: { symbol: "desc" } },
    take: 6,
  });

  if (top.length === 0) return null;

  const quotes = await getQuotes(
    top.map((t) => ({ symbol: t.symbol, assetType: t.assetType })),
  );

  return (
    <Section
      title="Markets snapshot"
      subtitle="Where your most-traded symbols stand right now."
      action={
        <Link href="/markets" className="text-xs link">
          See all →
        </Link>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {top.map((t) => (
          <QuoteCard
            key={t.symbol}
            symbol={t.symbol}
            quote={quotes.get(normalizeSymbol(t.symbol))}
            trades={t._count._all}
            href={`/journal?symbol=${encodeURIComponent(t.symbol)}`}
          />
        ))}
      </div>
    </Section>
  );
}
