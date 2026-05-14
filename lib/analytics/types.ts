// Shapes used across the analytics engine.
// We accept a narrowed "TradeRecord" (rather than the Prisma type) so analytics
// stays decoupled from the persistence layer and is trivial to unit-test.

export type TradeRecord = {
  id: string;
  symbol: string;
  assetType: string;
  direction: "long" | "short" | string;
  size: number;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  fees: number;
  swap: number;
  openedAt: Date;
  closedAt: Date | null;
  status: string;
  outcome: string | null;
  pnl: number | null;
  pnlPct: number | null;
  rMultiple: number | null;
  strategyId: string | null;
  emotionPre?: string | null;
  emotionPost?: string | null;
  confidencePre?: number | null;
};

export type Range = { from?: Date; to?: Date };

export type GroupedStat = {
  key: string;
  label: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
  expectancy: number;
};
