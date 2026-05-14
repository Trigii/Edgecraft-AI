// Pre-trade copilot — the killer feature for beginners.
//
// Given a proposed trade and the trader's recent history + settings, return a list of
// validations: blockers (the copilot says "no"), warnings (proceed at your own risk),
// and observations (FYI).
//
// This is what actually saves a new trader's account: a checklist that runs *before*
// the click, not a post-mortem after the loss.

import type { TradeRecord } from "../analytics/types";
import {
  computeRiskAmount,
  computeRewardAmount,
  computeRiskRewardRatio,
} from "../analytics/metrics";

export type PreTradeInput = {
  symbol: string;
  direction: "long" | "short";
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  size: number;
  fees?: number;
  emotionPre?: string | null;
  confidencePre?: number | null;
};

export type AccountState = {
  balance: number;
  currency: string;
  openTradesCount: number;
  closedToday: TradeRecord[];
  recentClosed: TradeRecord[]; // last 10-20 closed trades, chronological
};

export type Settings = {
  riskPerTradePct: number;
  maxDailyLossPct: number;
  maxOpenTrades: number;
  minRiskReward: number;
  enforcePreTradeChecklist: boolean;
  tiltDetectionEnabled: boolean;
  overtradingThreshold: number;
};

export type Validation = {
  level: "block" | "warn" | "info" | "ok";
  code: string;
  title: string;
  message: string;
  data?: Record<string, number | string>;
};

export type PreTradeResult = {
  decision: "go" | "wait" | "stop";
  validations: Validation[];
  metrics: {
    riskAmount: number;
    rewardAmount: number;
    riskRewardRatio: number;
    riskPctOfAccount: number;
    rewardPctOfAccount: number;
    suggestedSize: number;
  };
};

export function evaluatePreTrade(
  input: PreTradeInput,
  account: AccountState,
  settings: Settings,
): PreTradeResult {
  const validations: Validation[] = [];

  // ---------- Metrics ----------
  const riskAmount =
    input.stopLoss != null
      ? computeRiskAmount({
          direction: input.direction,
          entryPrice: input.entryPrice,
          stopLoss: input.stopLoss,
          size: input.size,
        })
      : 0;

  const rewardAmount =
    input.takeProfit != null
      ? computeRewardAmount({
          direction: input.direction,
          entryPrice: input.entryPrice,
          takeProfit: input.takeProfit,
          size: input.size,
        })
      : 0;

  const riskRewardRatio =
    input.stopLoss != null && input.takeProfit != null
      ? computeRiskRewardRatio({
          direction: input.direction,
          entryPrice: input.entryPrice,
          stopLoss: input.stopLoss,
          takeProfit: input.takeProfit,
        })
      : 0;

  const riskPctOfAccount = account.balance > 0 ? (riskAmount / account.balance) * 100 : 0;
  const rewardPctOfAccount = account.balance > 0 ? (rewardAmount / account.balance) * 100 : 0;

  // Suggested position size = account * riskPct% / (entry-stop distance)
  let suggestedSize = 0;
  if (input.stopLoss != null) {
    const distance =
      input.direction === "short"
        ? input.stopLoss - input.entryPrice
        : input.entryPrice - input.stopLoss;
    if (distance > 0) {
      const allowedRisk = account.balance * (settings.riskPerTradePct / 100);
      suggestedSize = allowedRisk / distance;
    }
  }

  // ---------- Validations (block / warn / info / ok) ----------

  // Stop loss is mandatory.
  if (input.stopLoss == null) {
    validations.push({
      level: "block",
      code: "no-stop-loss",
      title: "Set a stop loss",
      message:
        "The copilot will not approve a trade without a stop loss. Even a wide stop is better than none.",
    });
  } else {
    // Stop loss is on the wrong side.
    const slOnWrongSide =
      input.direction === "long"
        ? input.stopLoss >= input.entryPrice
        : input.stopLoss <= input.entryPrice;
    if (slOnWrongSide) {
      validations.push({
        level: "block",
        code: "sl-wrong-side",
        title: "Stop loss is on the wrong side of entry",
        message: `For a ${input.direction} trade, stop must be ${
          input.direction === "long" ? "below" : "above"
        } entry.`,
      });
    }
  }

  // Take profit on wrong side (warning, not block — some traders trail manually).
  if (input.takeProfit != null) {
    const tpOnWrongSide =
      input.direction === "long"
        ? input.takeProfit <= input.entryPrice
        : input.takeProfit >= input.entryPrice;
    if (tpOnWrongSide) {
      validations.push({
        level: "block",
        code: "tp-wrong-side",
        title: "Take profit is on the wrong side of entry",
        message: `For a ${input.direction} trade, target must be ${
          input.direction === "long" ? "above" : "below"
        } entry.`,
      });
    }
  } else {
    validations.push({
      level: "warn",
      code: "no-take-profit",
      title: "No take profit defined",
      message:
        "Setting an explicit target before entry beats deciding at the moment of profit, when emotions kick in.",
    });
  }

  // R:R below minimum.
  if (riskRewardRatio > 0 && riskRewardRatio < settings.minRiskReward) {
    validations.push({
      level: "block",
      code: "rr-below-min",
      title: `Risk:Reward is ${riskRewardRatio.toFixed(2)}:1 — below your minimum of ${settings.minRiskReward}:1`,
      message:
        `At your current win rate, you need at least ${settings.minRiskReward}:1 to be profitable long-term. ` +
        `Either move target further, tighten stop, or skip the setup.`,
      data: { rr: riskRewardRatio, min: settings.minRiskReward },
    });
  }

  // Risk too large vs account.
  if (riskPctOfAccount > settings.riskPerTradePct * 1.5) {
    validations.push({
      level: "block",
      code: "size-too-large",
      title: `Position risks ${riskPctOfAccount.toFixed(2)}% of account`,
      message:
        `Your max per trade is ${settings.riskPerTradePct.toFixed(2)}%. ` +
        `Suggested size: ${suggestedSize.toFixed(4)}.`,
      data: { riskPct: riskPctOfAccount, max: settings.riskPerTradePct, suggestedSize },
    });
  } else if (riskPctOfAccount > settings.riskPerTradePct) {
    validations.push({
      level: "warn",
      code: "size-slightly-large",
      title: `Position risks ${riskPctOfAccount.toFixed(2)}% (target ≤ ${settings.riskPerTradePct.toFixed(2)}%)`,
      message: `Consider sizing down to ${suggestedSize.toFixed(4)}.`,
      data: { riskPct: riskPctOfAccount, max: settings.riskPerTradePct, suggestedSize },
    });
  }

  // Too many open trades.
  if (account.openTradesCount >= settings.maxOpenTrades) {
    validations.push({
      level: "block",
      code: "too-many-open",
      title: `You have ${account.openTradesCount} open trades`,
      message: `Close some before adding more. Limit: ${settings.maxOpenTrades}.`,
    });
  }

  // Daily loss limit.
  const todayPnl = account.closedToday.reduce((a, t) => a + (t.pnl ?? 0), 0);
  const todayLossPct = account.balance > 0 ? (todayPnl / account.balance) * 100 : 0;
  if (todayPnl < 0 && Math.abs(todayLossPct) >= settings.maxDailyLossPct) {
    validations.push({
      level: "block",
      code: "daily-loss-limit",
      title: `Daily loss limit hit (${todayLossPct.toFixed(2)}%)`,
      message:
        "Markets will be here tomorrow. Step away — this is the rule that keeps your account alive.",
      data: { todayLossPct, limit: settings.maxDailyLossPct },
    });
  } else if (todayPnl < 0 && Math.abs(todayLossPct) >= settings.maxDailyLossPct * 0.7) {
    validations.push({
      level: "warn",
      code: "near-daily-limit",
      title: `Approaching daily loss limit (${todayLossPct.toFixed(2)}% / ${settings.maxDailyLossPct}%)`,
      message: "Reduce size or pause until tomorrow.",
    });
  }

  // Tilt: consecutive losses.
  if (settings.tiltDetectionEnabled && account.recentClosed.length >= 3) {
    const last = account.recentClosed.slice(-5);
    let streak = 0;
    for (let i = last.length - 1; i >= 0; i--) {
      if ((last[i].pnl ?? 0) < 0) streak++;
      else break;
    }
    if (streak >= 3) {
      validations.push({
        level: "warn",
        code: "tilt-streak",
        title: `${streak} losses in a row — tilt risk`,
        message:
          "Stand up, walk away for 15 minutes, re-read the setup. If you're still convinced, the trade will still be there.",
        data: { streak },
      });
    }
  }

  // Overtrading today.
  if (account.closedToday.length >= settings.overtradingThreshold) {
    validations.push({
      level: "warn",
      code: "overtrading",
      title: `${account.closedToday.length} trades today — overtrading risk`,
      message:
        "Each new trade after your daily quota statistically underperforms. The best opportunity is rarely the next one.",
    });
  }

  // Emotional state.
  if (input.emotionPre === "fomo" || input.emotionPre === "revenge") {
    validations.push({
      level: "warn",
      code: "bad-emotion",
      title: `Self-reported state: ${input.emotionPre}`,
      message:
        input.emotionPre === "fomo"
          ? "FOMO trades have historically had negative expectancy across most journals. Wait for the next setup."
          : "Revenge trades have the worst statistical outcome in trading. Close the platform for 30 minutes.",
    });
  }

  // Confidence sanity check.
  if (input.confidencePre != null && input.confidencePre <= 4) {
    validations.push({
      level: "warn",
      code: "low-confidence",
      title: `Self-confidence is ${input.confidencePre}/10`,
      message:
        "If you wouldn't bet your salary on this idea, don't bet a meaningful portion of your account.",
    });
  }

  // If everything passes, an OK line.
  if (validations.every((v) => v.level === "info" || v.level === "ok")) {
    validations.unshift({
      level: "ok",
      code: "all-clear",
      title: "Setup passes all pre-trade checks",
      message: "Stop loss set, R:R acceptable, size within risk budget. Execute the plan.",
    });
  }

  const hasBlock = validations.some((v) => v.level === "block");
  const hasWarn = validations.some((v) => v.level === "warn");

  return {
    decision: hasBlock ? "stop" : hasWarn ? "wait" : "go",
    validations,
    metrics: {
      riskAmount,
      rewardAmount,
      riskRewardRatio,
      riskPctOfAccount,
      rewardPctOfAccount,
      suggestedSize,
    },
  };
}
