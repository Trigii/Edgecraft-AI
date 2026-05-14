import { Section } from "@/components/ui/section";
import { Empty } from "@/components/ui/empty";
import { prisma } from "@/lib/db";
import { getDefaultUser } from "@/lib/queries";
import { refreshInsights, dismissInsight, pinInsight } from "@/app/actions/insights";
import { AlertTriangle, Sparkles, Lightbulb, ShieldCheck, ShieldAlert, Pin, X, RefreshCw } from "lucide-react";
import { isAiEnabled } from "@/lib/ai/copilot";
import { AiReviewBlock } from "./ai-review";

export const dynamic = "force-dynamic";

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];

export default async function InsightsPage() {
  const user = await getDefaultUser();
  const insights = await prisma.insight.findMany({
    where: { userId: user.id, isDismissed: false },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
  });

  insights.sort((a, b) => {
    const aP = a.isPinned ? -1 : 0;
    const bP = b.isPinned ? -1 : 0;
    if (aP !== bP) return aP - bP;
    return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
  });

  return (
    <div className="space-y-6">
      <Section
        title="Insights"
        subtitle="Patterns the system found in your trading. Refresh after you log new trades."
        action={
          <form action={refreshInsights}>
            <button type="submit" className="btn-ghost text-sm">
              <RefreshCw size={14} /> Refresh
            </button>
          </form>
        }
      >
        {insights.length === 0 ? (
          <Empty
            title="No insights yet"
            subtitle="Log a few trades and hit Refresh. Most behavioral patterns need 20+ closed trades to be reliable."
            action={
              <form action={refreshInsights}>
                <button className="btn-primary">Run analysis now</button>
              </form>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
        )}
      </Section>

      {isAiEnabled() && (
        <Section title="AI weekly review" subtitle="Qualitative read by Claude based on your stats.">
          <AiReviewBlock />
        </Section>
      )}
    </div>
  );
}

function InsightCard({ insight }: { insight: { id: string; kind: string; severity: string; title: string; body: string; isPinned: boolean } }) {
  const map: Record<string, { Icon: typeof Sparkles; cls: string }> = {
    warning: { Icon: AlertTriangle, cls: "border-warn/40" },
    pattern: { Icon: Lightbulb, cls: "border-info/40" },
    strength: { Icon: ShieldCheck, cls: "border-bull/40" },
    suggestion: { Icon: Sparkles, cls: "border-edge/40" },
    ai: { Icon: Sparkles, cls: "border-edge/40" },
  };
  const cfg = map[insight.kind] ?? map.pattern;
  const severityTone =
    insight.severity === "critical"
      ? "text-bear"
      : insight.severity === "high"
        ? "text-bear"
        : insight.severity === "medium"
          ? "text-warn"
          : "text-ink-muted";

  return (
    <div className={`card border ${cfg.cls}`}>
      <div className="flex items-start gap-2">
        <cfg.Icon size={18} className={severityTone} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{insight.title}</h3>
            {insight.severity === "critical" && <span className="badge-bear">critical</span>}
            {insight.severity === "high" && <span className="badge-bear">high</span>}
            {insight.severity === "medium" && <span className="badge-warn">medium</span>}
          </div>
          <p className="text-sm text-ink-muted mt-1.5 leading-relaxed">{insight.body}</p>
        </div>
        <div className="flex flex-col gap-1">
          <form action={pinInsight}>
            <input type="hidden" name="id" value={insight.id} />
            <button title={insight.isPinned ? "Unpin" : "Pin"} className="text-ink-subtle hover:text-ink">
              <Pin size={14} className={insight.isPinned ? "text-edge fill-edge" : ""} />
            </button>
          </form>
          <form action={dismissInsight}>
            <input type="hidden" name="id" value={insight.id} />
            <button title="Dismiss" className="text-ink-subtle hover:text-ink">
              <X size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
