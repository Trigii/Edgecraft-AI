// Seed script — populates a realistic trading history so a first-time user
// sees the product alive on load. Generates ~120 trades across forex + crypto
// + stocks, with intentional behavioral patterns (Friday losses, FOMO on BTC,
// strong edge on EURUSD morning London session) so the insights engine has
// something to detect.

import { PrismaClient } from "@prisma/client";
import { computeTradePnl, computeRiskAmount } from "../lib/analytics/metrics";

const prisma = new PrismaClient();

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function chance(p: number) {
  return Math.random() < p;
}

type Plan = {
  symbol: string;
  assetType: string;
  pricePivot: number;
  volatility: number;             // typical % stop distance
  preferredHours: number[];       // UTC hours where edge exists
  baseWinRate: number;
  // P&L modifiers based on time
  hourMod?: (h: number) => number;
  dowMod?: (d: number) => number;
};

const PLANS: Plan[] = [
  {
    symbol: "EURUSD",
    assetType: "forex",
    pricePivot: 1.085,
    volatility: 0.0025,
    preferredHours: [7, 8, 9, 10, 11],
    baseWinRate: 0.58,
    hourMod: (h) => (h >= 7 && h <= 11 ? 1.15 : h >= 18 ? 0.6 : 0.9),
    dowMod: (d) => (d === 5 ? 0.6 : 1.0), // Friday loses edge
  },
  {
    symbol: "GBPUSD",
    assetType: "forex",
    pricePivot: 1.265,
    volatility: 0.003,
    preferredHours: [8, 9, 10, 13, 14],
    baseWinRate: 0.5,
  },
  {
    symbol: "USDJPY",
    assetType: "forex",
    pricePivot: 152.5,
    volatility: 0.0035,
    preferredHours: [0, 1, 12, 13],
    baseWinRate: 0.48,
  },
  {
    symbol: "BTCUSDT",
    assetType: "crypto",
    pricePivot: 67000,
    volatility: 0.018,
    preferredHours: [13, 14, 15, 20, 21],
    baseWinRate: 0.42, // Crypto chases hurt
    hourMod: (h) => (h >= 20 ? 0.7 : 1),
  },
  {
    symbol: "ETHUSDT",
    assetType: "crypto",
    pricePivot: 3500,
    volatility: 0.022,
    preferredHours: [13, 14, 15],
    baseWinRate: 0.45,
  },
  {
    symbol: "AAPL",
    assetType: "stock",
    pricePivot: 225,
    volatility: 0.012,
    preferredHours: [14, 15, 19, 20],
    baseWinRate: 0.55,
  },
  {
    symbol: "TSLA",
    assetType: "stock",
    pricePivot: 250,
    volatility: 0.025,
    preferredHours: [14, 15, 19, 20],
    baseWinRate: 0.4, // High vol stock, weaker edge
  },
];

function fmt(d: Date) {
  return d.toISOString();
}

async function main() {
  console.log("Resetting tables…");
  await prisma.tradeTag.deleteMany();
  await prisma.checklistResponse.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.strategy.deleteMany();
  await prisma.balanceSnapshot.deleteMany();
  await prisma.account.deleteMany();
  await prisma.insight.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.checklist.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.user.deleteMany();

  console.log("Creating user + settings…");
  const user = await prisma.user.create({
    data: {
      name: "Demo Trader",
      experience: "beginner",
      settings: {
        create: {
          baseCurrency: "USD",
          riskPerTradePct: 1.0,
          maxDailyLossPct: 3.0,
          maxOpenTrades: 5,
          minRiskReward: 1.5,
          enforcePreTradeChecklist: true,
          tiltDetectionEnabled: true,
          overtradingThreshold: 5,
        },
      },
    },
  });

  console.log("Creating account…");
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      name: "Practice account",
      broker: "Demo",
      accountType: "demo",
      assetFocus: "mixed",
      currency: "USD",
      initialBalance: 10000,
      leverage: 30,
    },
  });

  console.log("Creating strategies…");
  const strategies = await Promise.all([
    prisma.strategy.create({
      data: {
        userId: user.id,
        name: "London Open Breakout",
        description: "Trade the first impulse out of the Asian range during London session.",
        playbook:
          "Entry: break of Asian high/low with momentum candle. Stop: opposite side of Asian range. TP: 2R or session high/low.",
        markets: "forex",
        timeframes: "5m, 15m",
        color: "#7cf5b6",
      },
    }),
    prisma.strategy.create({
      data: {
        userId: user.id,
        name: "Mean Reversion VWAP",
        description: "Fade extensions away from VWAP into the close.",
        markets: "stocks, indices",
        timeframes: "5m, 15m",
        color: "#3b82f6",
      },
    }),
    prisma.strategy.create({
      data: {
        userId: user.id,
        name: "Crypto News Fade",
        description: "Fade extreme reactions to news once volume rolls over.",
        markets: "crypto",
        timeframes: "15m, 1h",
        color: "#f59e0b",
      },
    }),
    prisma.strategy.create({
      data: {
        userId: user.id,
        name: "Untagged exploration",
        description: "Trades taken without a defined playbook (intentionally tracked).",
        markets: "any",
        color: "#8a94a6",
      },
    }),
  ]);

  console.log("Creating default checklist…");
  await prisma.checklist.create({
    data: {
      userId: user.id,
      name: "Pre-trade checklist",
      isDefault: true,
      items: JSON.stringify([
        { id: "thesis", text: "I can state the thesis in one sentence", required: true, category: "process" },
        { id: "sl", text: "Stop loss is set at a structural level", required: true, category: "risk" },
        { id: "rr", text: "R:R is at least 1.5:1", required: true, category: "risk" },
        { id: "size", text: "Size is within my 1% risk budget", required: true, category: "risk" },
        { id: "news", text: "No high-impact news in the next 30 minutes", required: false, category: "context" },
        { id: "emotion", text: "I am not chasing or in revenge mode", required: true, category: "emotion" },
      ]),
    },
  });

  console.log("Creating tags…");
  const tagNames = [
    "breakout",
    "reversion",
    "news",
    "fomo",
    "revenge",
    "london",
    "new-york",
    "asia",
    "discipline",
    "moved-stop",
  ];
  await Promise.all(
    tagNames.map((name) =>
      prisma.tag.create({
        data: { userId: user.id, name, category: name === "fomo" || name === "revenge" || name === "moved-stop" ? "mistake" : "general" },
      }),
    ),
  );

  console.log("Generating trades…");
  const now = new Date();
  const days = 90;
  const trades: { params: Parameters<typeof prisma.trade.create>[0] }[] = [];

  for (let dayOffset = days; dayOffset >= 1; dayOffset--) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - dayOffset);
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue; // skip weekends

    const tradesToday = chance(0.85) ? Math.floor(rand(1, 5)) : 0;

    for (let i = 0; i < tradesToday; i++) {
      const plan = pick(PLANS);
      const hour = chance(0.65)
        ? pick(plan.preferredHours)
        : Math.floor(rand(0, 24));
      const minute = Math.floor(rand(0, 60));
      const opened = new Date(date);
      opened.setUTCHours(hour, minute, 0, 0);

      const direction = chance(0.55) ? "long" : "short";
      const drift = rand(-0.003, 0.003);
      const entryPrice = plan.pricePivot * (1 + drift);
      const stopDistance = entryPrice * plan.volatility * rand(0.6, 1.5);
      const targetDistance = stopDistance * rand(1.2, 3.0);
      const stopLoss =
        direction === "long" ? entryPrice - stopDistance : entryPrice + stopDistance;
      const takeProfit =
        direction === "long" ? entryPrice + targetDistance : entryPrice - targetDistance;

      // Position size = 1% of $10k / stop distance — but with realistic deviation.
      const riskAmount = 100 * rand(0.6, 1.6);
      const size = riskAmount / stopDistance;

      const hourMod = plan.hourMod?.(hour) ?? 1;
      const dowMod = plan.dowMod?.(date.getUTCDay()) ?? 1;
      const effectiveWR = Math.max(0.1, Math.min(0.85, plan.baseWinRate * hourMod * dowMod));

      const isWin = chance(effectiveWR);
      // R outcomes: winners 0.5..3R, losers ~ -1R (sometimes deeper)
      const rOutcome = isWin
        ? rand(0.6, plan.baseWinRate > 0.5 ? 2.5 : 1.6)
        : chance(0.12)
          ? -rand(1.05, 1.8) // moved stop / slippage
          : -rand(0.9, 1.05);

      const exitPrice =
        direction === "long"
          ? entryPrice + rOutcome * stopDistance
          : entryPrice - rOutcome * stopDistance;

      const fees = plan.assetType === "stock" ? rand(0.5, 1.5) : rand(0.1, 0.7);
      const swap = plan.assetType === "forex" && chance(0.2) ? rand(-1, 0.2) : 0;

      const holdMinutes = Math.floor(
        rand(
          plan.assetType === "crypto" ? 30 : 15,
          plan.assetType === "crypto" ? 720 : 240,
        ),
      );
      const closed = new Date(opened);
      closed.setUTCMinutes(closed.getUTCMinutes() + holdMinutes);
      if (closed > now) continue;

      const pnl = computeTradePnl({
        direction,
        entryPrice,
        exitPrice,
        size,
        fees,
        swap,
      });
      const risk = computeRiskAmount({
        direction,
        entryPrice,
        stopLoss,
        size,
      });
      const rMultiple = risk > 0 ? pnl / risk : null;

      const noStop = chance(0.05); // 5% of trades intentionally lack stops (to trigger insight)
      const emotion = chance(0.7)
        ? pick(["calm", "calm", "confident", "uncertain"])
        : pick(["fomo", "revenge"]);
      const strategyId = pick(strategies).id;

      trades.push({
        params: {
          data: {
            accountId: account.id,
            symbol: plan.symbol,
            assetType: plan.assetType,
            direction,
            size,
            entryPrice,
            stopLoss: noStop ? null : stopLoss,
            takeProfit,
            exitPrice,
            fees,
            swap,
            openedAt: opened,
            closedAt: closed,
            status: "closed",
            outcome: pnl > 0 ? "win" : pnl < 0 ? "loss" : "breakeven",
            pnl,
            pnlPct: (pnl / 10000) * 100,
            rMultiple,
            strategyId,
            emotionPre: emotion,
            confidencePre: Math.floor(rand(3, 10)),
            thesis: pick([
              "Break of structure with confluence at the level.",
              "Liquidity sweep then reclaim.",
              "Failed move at session high.",
              "VWAP rejection in range.",
              "News spike fade.",
              null,
            ]) ?? undefined,
            notes: chance(0.4)
              ? pick([
                  "Hit TP cleanly.",
                  "Moved stop and got tagged. Don't do that.",
                  "Should have waited for confirmation.",
                  "Saw the level, sized too small.",
                  "Followed plan exactly. Boring is good.",
                ])
              : undefined,
          },
        },
      });
    }
  }

  // Persist sequentially to avoid SQLite write contention
  let i = 0;
  for (const t of trades) {
    await prisma.trade.create(t.params);
    i++;
    if (i % 20 === 0) console.log(`  ${i}/${trades.length} trades`);
  }

  // A handful of OPEN positions so the live-quotes / live-P&L UI has
  // something to render on the first visit. These intentionally use the
  // same symbol routing the market layer recognises (EURUSD, BTCUSDT,
  // AAPL) so the user sees real prices flowing in.
  console.log("Adding open positions…");
  const openPlans: { plan: Plan; direction: "long" | "short"; offsetMinutes: number }[] = [
    { plan: PLANS[0], direction: "long", offsetMinutes: 240 },
    { plan: PLANS[3], direction: "long", offsetMinutes: 90 },
    { plan: PLANS[5], direction: "short", offsetMinutes: 30 },
  ];
  for (const { plan, direction, offsetMinutes } of openPlans) {
    const opened = new Date(now);
    opened.setUTCMinutes(opened.getUTCMinutes() - offsetMinutes);
    const entryPrice = plan.pricePivot * (1 + rand(-0.001, 0.001));
    const stopDistance = entryPrice * plan.volatility;
    const stopLoss =
      direction === "long" ? entryPrice - stopDistance : entryPrice + stopDistance;
    const takeProfit =
      direction === "long" ? entryPrice + stopDistance * 2 : entryPrice - stopDistance * 2;
    const size = 100 / stopDistance; // ~$100 risk
    await prisma.trade.create({
      data: {
        accountId: account.id,
        symbol: plan.symbol,
        assetType: plan.assetType,
        direction,
        size,
        entryPrice,
        stopLoss,
        takeProfit,
        fees: 0,
        swap: 0,
        openedAt: opened,
        status: "open",
        thesis: pick([
          "Break of yesterday's high after consolidation.",
          "VWAP reclaim with rising volume.",
          "Failed move at major level — taking the reverse.",
        ]),
        emotionPre: "calm",
        confidencePre: Math.floor(rand(6, 9)),
        strategyId: pick(strategies).id,
      },
    });
  }

  console.log(`Seeded ${trades.length} closed trades + ${openPlans.length} open positions.`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
