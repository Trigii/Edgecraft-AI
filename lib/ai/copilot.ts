// AI Copilot — optional layer on top of the rule-based engine.
//
// Why optional? The product must be 100% functional without an API key. The rule-based
// insights engine is the floor; AI is the ceiling. If a user provides ANTHROPIC_API_KEY,
// they unlock qualitative analysis and natural-language Q&A about their performance.
//
// We deliberately keep prompts compact. The conversation is grounded on a structured
// summary of the trader's stats (not raw trade dumps) so we don't blow context and
// don't risk leaking personal notes when not needed.

import Anthropic from "@anthropic-ai/sdk";
import type { CoreMetrics } from "../analytics/metrics";
import type { EquityStats } from "../analytics/equity";
import type { RiskMetrics } from "../analytics/risk";

export function isAiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function client() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are Edgecraft, an AI trading coach embedded in a journaling and analytics tool.

Your job is to help the trader find their edge and protect them from common destructive behaviors. You are NOT a market-prediction tool — never give buy/sell calls or price predictions. You analyze the trader's own history.

Style:
- Direct, specific, evidence-based. Cite numbers from the data provided.
- Speak like a senior mentor, not a hype account. No emojis, no "rocket to the moon".
- Lead with the highest-impact observation. Don't pad.
- If the data is too thin to draw a conclusion, say so.
- Keep responses under 200 words unless the user asks for depth.

Hard rules:
- Never recommend specific entries, exits, or instruments to trade.
- If the user appears to be in financial distress or chasing losses, recommend they pause and seek help.
`;

type StatsContext = {
  core: CoreMetrics;
  equity: EquityStats;
  risk: RiskMetrics;
  topSymbols: { label: string; trades: number; winRate: number; pnl: number }[];
  worstSymbols: { label: string; trades: number; winRate: number; pnl: number }[];
  recentNotes?: string[];
};

function formatStats(s: StatsContext): string {
  return [
    `Trader summary:`,
    `- Closed trades: ${s.core.totalTrades}, wins ${s.core.wins}, losses ${s.core.losses}`,
    `- Win rate: ${s.core.winRate.toFixed(1)}%`,
    `- Net P&L: ${s.core.netPnl.toFixed(2)}, profit factor ${s.core.profitFactor.toFixed(2)}`,
    `- Avg win ${s.core.avgWin.toFixed(2)}, avg loss ${s.core.avgLoss.toFixed(2)}, expectancy ${s.core.expectancy.toFixed(2)}`,
    `- Max drawdown: ${s.equity.maxDrawdownPct.toFixed(2)}% (${s.equity.maxDrawdown.toFixed(2)})`,
    `- Sharpe ${s.risk.sharpe.toFixed(2)}, Sortino ${s.risk.sortino.toFixed(2)}, Calmar ${s.risk.calmar.toFixed(2)}`,
    `- Best streak: ${s.core.bestStreakWins} wins; worst streak: ${s.core.worstStreakLosses} losses`,
    s.topSymbols.length > 0
      ? `Top symbols: ${s.topSymbols
          .slice(0, 3)
          .map((t) => `${t.label} (${t.winRate.toFixed(0)}% WR, ${t.pnl.toFixed(0)} P&L, ${t.trades} trades)`)
          .join("; ")}`
      : "",
    s.worstSymbols.length > 0
      ? `Worst symbols: ${s.worstSymbols
          .slice(0, 3)
          .map((t) => `${t.label} (${t.winRate.toFixed(0)}% WR, ${t.pnl.toFixed(0)} P&L, ${t.trades} trades)`)
          .join("; ")}`
      : "",
    s.recentNotes && s.recentNotes.length > 0
      ? `Recent trade notes (most recent first):\n${s.recentNotes.slice(0, 5).map((n, i) => `${i + 1}. ${n}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function aiReview(stats: StatsContext): Promise<string> {
  const c = client();
  const resp = await c.messages.create({
    model: MODEL(),
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          `Give me a concise weekly review of my trading. Identify the single biggest leak in my process and one strength to lean into.\n\n${formatStats(
            stats,
          )}`,
      },
    ],
  });
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return text;
}

export async function aiAsk(stats: StatsContext, question: string): Promise<string> {
  const c = client();
  const resp = await c.messages.create({
    model: MODEL(),
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${formatStats(stats)}\n\nQuestion: ${question}`,
      },
    ],
  });
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

export async function aiTradePostMortem(args: {
  symbol: string;
  direction: string;
  pnl: number;
  rMultiple: number | null;
  thesis: string | null;
  notes: string | null;
  outcome: string | null;
}): Promise<string> {
  const c = client();
  const resp = await c.messages.create({
    model: MODEL(),
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          `Post-mortem this trade — what process question should I ask myself? 100 words max.\n\n` +
          `Symbol: ${args.symbol}\n` +
          `Direction: ${args.direction}\n` +
          `Outcome: ${args.outcome ?? "n/a"} (${args.pnl.toFixed(2)}, ${args.rMultiple?.toFixed(2) ?? "?"}R)\n` +
          `Pre-trade thesis: ${args.thesis ?? "(none)"}\n` +
          `Post-trade notes: ${args.notes ?? "(none)"}`,
      },
    ],
  });
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
