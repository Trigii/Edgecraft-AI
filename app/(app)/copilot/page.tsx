import { Section } from "@/components/ui/section";
import { Empty } from "@/components/ui/empty";
import { getDefaultUser, getActiveAccount } from "@/lib/queries";
import { PreTradeForm } from "./form";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CopilotPage() {
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

  return (
    <Section
      title="Pre-trade copilot"
      subtitle="Run the trade idea through the gauntlet before you click. The copilot uses your risk settings, today's P&L, your recent streak, and your behavioral patterns."
    >
      <PreTradeForm
        currency={account.currency}
        defaults={{
          riskPerTradePct: user.settings.riskPerTradePct,
          minRiskReward: user.settings.minRiskReward,
        }}
      />
    </Section>
  );
}
