import { Section } from "@/components/ui/section";
import { CalculatorClient } from "./client";
import { getDefaultUser, getActiveAccount } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { Empty } from "@/components/ui/empty";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CalculatorPage() {
  const user = await getDefaultUser();
  const account = await getActiveAccount(user.id);
  if (!account || !user.settings) {
    return (
      <Empty
        title="Set up an account first"
        action={<Link className="btn-primary" href="/settings">Settings</Link>}
      />
    );
  }
  const closedAgg = await prisma.trade.aggregate({
    where: { accountId: account.id, status: "closed" },
    _sum: { pnl: true },
  });
  const balance = account.initialBalance + (closedAgg._sum.pnl ?? 0);

  return (
    <Section
      title="Position size calculator"
      subtitle="Tell it the trade idea, it tells you the right size — and what's at stake."
    >
      <CalculatorClient
        balance={balance}
        currency={account.currency}
        defaultRiskPct={user.settings.riskPerTradePct}
        defaultMinRR={user.settings.minRiskReward}
      />
    </Section>
  );
}
