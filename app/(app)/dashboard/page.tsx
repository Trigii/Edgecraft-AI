import { getDefaultUser, getActiveAccount, getTradesForAccount } from "@/lib/queries";
import { Kpi } from "@/components/ui/kpi";
import { Section } from "@/components/ui/section";
import { Empty } from "@/components/ui/empty";
import { EquityChart } from "@/components/charts/equity-chart";
import { DrawdownChart } from "@/components/charts/drawdown-chart";
import { PnlBars } from "@/components/charts/pnl-bars";
import { HourDayHeatmap } from "@/components/charts/heatmap";
import { WinRatePie } from "@/components/charts/winrate-pie";
import { MarketsSnapshot } from "@/components/markets/markets-snapshot";
import { OpenPositions } from "@/components/markets/open-positions";
import {
  computeCoreMetrics,
  computeEquityCurve,
  computeRiskMetrics,
  byStat,
  hourDayHeatmap,
} from "@/lib/analytics";
import { formatCurrency, formatNumber, signed } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getDefaultUser();
  const account = await getActiveAccount(user.id);

  if (!account) {
    return (
      <Empty
        title="Create your first account"
        subtitle="An account represents a broker connection (e.g. Binance Spot, IBKR Live, FTMO Challenge). You can have several."
        action={
          <Link className="btn-primary" href="/settings">
            Go to settings
          </Link>
        }
      />
    );
  }

  const trades = await getTradesForAccount(account.id);
  if (trades.length === 0) {
    return (
      <Empty
        title="No trades yet"
        subtitle="Log your first trade — or run the pre-trade copilot before you place one. The dashboard fills in instantly as you trade."
        action={
          <div className="flex gap-2">
            <Link className="btn-primary" href="/journal/new">
              Log a trade
            </Link>
            <Link className="btn-ghost" href="/copilot">
              Open pre-trade copilot
            </Link>
          </div>
        }
      />
    );
  }

  const core = computeCoreMetrics(trades);
  const { points: equityPoints, stats: equityStats } = computeEquityCurve(trades, account.initialBalance);
  const risk = computeRiskMetrics(trades, account.initialBalance, equityStats.maxDrawdownPct);
  const groups = byStat(trades);
  const heat = hourDayHeatmap(trades);

  const currency = account.currency;
  const netPnlPct = ((core.netPnl / account.initialBalance) * 100).toFixed(2);

  return (
    <div className="space-y-6">
      <MarketsSnapshot accountId={account.id} />

      <OpenPositions accountId={account.id} currency={currency} />

      <Section title="Performance" subtitle={`${account.name} · since ${account.createdAt.toISOString().slice(0, 10)}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi
            label="Net P&L"
            value={formatCurrency(core.netPnl, currency)}
            sub={`${signed(Number(netPnlPct), 2)}% of starting balance`}
            tone={core.netPnl >= 0 ? "bull" : "bear"}
            trend={core.netPnl >= 0 ? "up" : "down"}
          />
          <Kpi
            label="Win rate"
            value={`${core.winRate.toFixed(1)}%`}
            sub={`${core.wins}W / ${core.losses}L / ${core.breakevens}BE`}
          />
          <Kpi
            label="Profit factor"
            value={isFinite(core.profitFactor) ? core.profitFactor.toFixed(2) : "∞"}
            sub={`payoff ${isFinite(core.payoffRatio) ? core.payoffRatio.toFixed(2) : "∞"}`}
            tone={core.profitFactor >= 1.5 ? "bull" : core.profitFactor >= 1 ? "default" : "bear"}
          />
          <Kpi
            label="Expectancy / trade"
            value={formatCurrency(core.expectancy, currency)}
            sub={`${core.expectancyR.toFixed(2)} R avg`}
            tone={core.expectancy >= 0 ? "bull" : "bear"}
          />
          <Kpi
            label="Max drawdown"
            value={`${equityStats.maxDrawdownPct.toFixed(2)}%`}
            sub={formatCurrency(equityStats.maxDrawdown, currency)}
            tone="bear"
          />
          <Kpi
            label="Recovery factor"
            value={isFinite(equityStats.recoveryFactor) ? equityStats.recoveryFactor.toFixed(2) : "∞"}
            sub="net profit / max DD"
          />
          <Kpi label="Sharpe (annualized)" value={risk.sharpe.toFixed(2)} sub={`Sortino ${risk.sortino.toFixed(2)}`} />
          <Kpi label="Calmar" value={risk.calmar.toFixed(2)} sub={`vol ${risk.stdDevDaily.toFixed(2)}% daily`} />
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title="Equity curve" className="lg:col-span-2">
          <div className="card">
            <EquityChart points={equityPoints} />
          </div>
        </Section>
        <Section title="Wins vs losses">
          <div className="card">
            <WinRatePie wins={core.wins} losses={core.losses} breakevens={core.breakevens} />
            <div className="mt-3 grid grid-cols-3 text-center text-xs">
              <div>
                <div className="text-bull font-mono">{formatCurrency(core.avgWin, currency)}</div>
                <div className="text-ink-subtle">avg win</div>
              </div>
              <div>
                <div className="text-bear font-mono">{formatCurrency(core.avgLoss, currency)}</div>
                <div className="text-ink-subtle">avg loss</div>
              </div>
              <div>
                <div className="font-mono">{formatNumber(core.avgHoldMinutes / 60, { maximumFractionDigits: 1 })}h</div>
                <div className="text-ink-subtle">avg hold</div>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <Section title="Drawdown" subtitle="Distance from the most recent equity high">
        <div className="card">
          <DrawdownChart points={equityPoints} />
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="P&L by symbol" subtitle="Where does the edge live?">
          <div className="card">
            <PnlBars data={groups.bySymbol.slice(0, 10)} />
            <GroupTable rows={groups.bySymbol.slice(0, 8)} />
          </div>
        </Section>
        <Section title="P&L by strategy">
          <div className="card">
            <PnlBars data={groups.byStrategy.slice(0, 10)} />
            <GroupTable rows={groups.byStrategy.slice(0, 8)} />
          </div>
        </Section>
        <Section title="P&L by hour of day">
          <div className="card">
            <PnlBars data={groups.byHour.sort((a, b) => Number(a.key) - Number(b.key))} />
          </div>
        </Section>
        <Section title="P&L by day of week">
          <div className="card">
            <PnlBars data={groups.byDayOfWeek} />
          </div>
        </Section>
      </div>

      <Section title="When you trade vs when you make money" subtitle="P&L heatmap — day × hour (UTC)">
        <div className="card">
          <HourDayHeatmap data={heat} />
        </div>
      </Section>

      <Section title="Extremes & streaks">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Largest win" value={formatCurrency(core.largestWin, currency)} tone="bull" />
          <Kpi label="Largest loss" value={formatCurrency(core.largestLoss, currency)} tone="bear" />
          <Kpi label="Best win streak" value={`${core.bestStreakWins} trades`} />
          <Kpi label="Worst loss streak" value={`${core.worstStreakLosses} trades`} tone="warn" />
          <Kpi label="Fees paid" value={formatCurrency(core.feesTotal, currency)} sub="cost of doing business" />
          <Kpi label="Swap/finance" value={formatCurrency(core.swapTotal, currency)} />
          <Kpi
            label="Avg R won"
            value={`${core.avgRWin.toFixed(2)}R`}
            sub={`vs ${Math.abs(core.avgRLoss).toFixed(2)}R lost`}
          />
          <Kpi
            label="Best day / Worst day"
            value={`${formatCurrency(risk.bestDay, currency)} / ${formatCurrency(risk.worstDay, currency)}`}
          />
        </div>
      </Section>
    </div>
  );
}

function GroupTable({
  rows,
}: {
  rows: { label: string; trades: number; winRate: number; pnl: number; expectancy: number }[];
}) {
  if (rows.length === 0) return null;
  return (
    <table className="w-full text-sm mt-4">
      <thead className="text-ink-subtle">
        <tr className="text-left">
          <th className="py-1 font-normal">Group</th>
          <th className="py-1 font-normal text-right">Trades</th>
          <th className="py-1 font-normal text-right">WR</th>
          <th className="py-1 font-normal text-right">P&L</th>
          <th className="py-1 font-normal text-right">Exp/trade</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-t border-bg-border">
            <td className="py-1.5 font-medium">{r.label}</td>
            <td className="py-1.5 text-right font-mono text-ink-muted">{r.trades}</td>
            <td className="py-1.5 text-right font-mono">{r.winRate.toFixed(0)}%</td>
            <td className={`py-1.5 text-right font-mono ${r.pnl >= 0 ? "text-bull" : "text-bear"}`}>
              {r.pnl.toFixed(2)}
            </td>
            <td className={`py-1.5 text-right font-mono ${r.expectancy >= 0 ? "text-bull" : "text-bear"}`}>
              {r.expectancy.toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
