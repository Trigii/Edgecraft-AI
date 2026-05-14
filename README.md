# Edgecraft AI

**Build your edge. Trade with clarity.**

A trading copilot for forex, stocks, crypto and futures traders. Validates ideas
*before* you enter, journals what actually happens, surfaces patterns in your own
behavior, and protects your account from the moves that blow it up.

Designed to be useful from your first trade as a beginner, and to keep paying back
when you're a pro tracking dozens of trades a week.

---

## Why it exists

Most journals are autopsies — they tell you *after* the loss what you should have
done. Most trader dashboards are vanity metrics — green or red numbers without a
*next action*.

Edgecraft is built around three convictions:

1. **The win is in the process.** A pre-trade checklist that refuses bad ideas
   beats post-mortem regret every time.
2. **Your worst enemy is your own pattern.** The leak that kills new accounts is
   almost always behavioral: revenge trading, overtrading, moving stops, FOMO.
   Detect it and you can fix it.
3. **Discipline is testable.** Every trade gets metadata — strategy, emotion,
   confidence, thesis. After 30 trades you can ask: *do I trade better when I'm
   confident?* (Usually the answer surprises people.)

---

## Features (v0.1)

### Pre-Trade Copilot
The flagship feature. Enter a trade idea and the copilot runs it through:

- **Stop loss enforcement** — refuses trades without one
- **R:R floor** — blocks trades below your minimum (default 1.5:1)
- **Position size budget** — refuses oversized trades; suggests the right size
- **Daily loss limit** — hard stop when you've lost too much today
- **Tilt detection** — warns after consecutive losses
- **Overtrading guard** — warns past your daily quota
- **Emotion screen** — flags FOMO / revenge entries
- **Sanity checks** — stop loss on wrong side of entry, etc.

Every check has a clear verdict: `go` / `wait` / `stop`. No ambiguity.

### Analytics dashboard
Industry-standard metrics, all computed from your journal:

- Net P&L, win rate, profit factor, payoff ratio
- Expectancy (currency and R-multiples)
- Max drawdown (%, currency, duration)
- Sharpe, Sortino, Calmar ratios (annualized)
- Recovery factor
- Best/worst streaks, biggest single trade
- Equity curve, drawdown curve, P&L distribution

### Performance by dimension
"Where is my edge?" answered by:

- **By symbol** — which pairs/tickers pay you
- **By strategy** — which playbook works
- **By hour of day** — your best trading window
- **By day of week** — your weakest day
- **By direction** — long/short bias check
- **By trade duration** — scalp vs swing comparison
- **By emotional state** — does FOMO actually cost you?
- **Hour × Day heatmap** — visual P&L grid

### Insights engine
Rule-based pattern detection — fires only when there's enough data:

- "Profit factor is 0.8 — system is unprofitable; here's why"
- "You're cutting winners short — avg win 0.7R, avg loss 1.0R"
- "Friday is your weakest day"
- "When tagged FOMO, expectancy is -$42 — pre-trade copilot will require 15-min cool-down"
- "Your confidence isn't predictive — 8/10 trades win at the same rate as 4/10 trades"
- "You have a long bias but your shorts perform better"
- "3-loss streak detected — tilt risk"

### Journal
Mandatory thesis, optional checklist, pre/post emotion, confidence rating,
strategy tag, free-form notes, mistake tags. Filter by status, outcome, symbol.
Trade detail page with full edit + close flow.

### Position size calculator
Standalone tool. Enter entry, stop, account risk %, and it tells you exactly
what size to enter — and what your P&L will be at stop and target.

### Strategies
A strategy is a named playbook. Tag each trade with the playbook you followed.
The dashboard compares them so you can kill the ones that don't work.

### AI Copilot (optional)
Drop in `ANTHROPIC_API_KEY` to unlock:

- **Weekly review** — Claude analyzes your stats and gives you the biggest leak
  and strength
- **Per-trade post-mortems** — pose the right question to ask yourself about a
  closed trade
- **Ask anything** — natural-language Q&A grounded on your stats

Crucially: AI **never** recommends entries/exits. It analyzes you, not the market.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Set up the database (SQLite for dev) and seed with sample data
cp .env.example .env
npm run setup        # = prisma db push + seed

# 3. Run
npm run dev
```

Open <http://localhost:3000>.

The seed creates 90 days of realistic trades across EURUSD, GBPUSD, BTCUSDT,
AAPL, TSLA etc., with intentional behavioral patterns (Friday underperformance,
FOMO losses on crypto) so the insights engine has something to detect on
first run.

Optional: add `ANTHROPIC_API_KEY` to `.env` to enable the AI copilot features.

---

## Architecture

```
edgecraft-ai/
├── app/                          # Next.js App Router
│   ├── (app)/                    # The authenticated app shell
│   │   ├── dashboard/            # KPIs + all charts
│   │   ├── journal/              # Trade list + create + detail
│   │   ├── copilot/              # Pre-trade copilot
│   │   ├── calculator/           # Position size calculator
│   │   ├── strategies/           # Playbook CRUD + comparison
│   │   ├── insights/             # Pattern detection + AI review
│   │   └── settings/             # Risk rules + accounts
│   ├── actions/                  # Server actions (mutations)
│   └── page.tsx                  # Marketing landing
├── components/
│   ├── ui/                       # Reusable primitives (Kpi, Section, Empty)
│   ├── charts/                   # Recharts wrappers
│   └── nav.tsx
├── lib/
│   ├── analytics/                # Pure functions: metrics, equity, risk, groupings
│   ├── insights/                 # Rule-based patterns + pre-trade engine
│   ├── ai/                       # Optional Anthropic SDK layer
│   ├── db.ts                     # Prisma client singleton
│   ├── queries.ts                # Read-side helpers
│   └── utils.ts
└── prisma/
    ├── schema.prisma             # Multi-user, multi-account, multi-asset
    └── seed.ts                   # 90 days of realistic sample trades
```

### Key design decisions

- **Single codebase, single deploy.** Next.js full-stack with Server Actions
  instead of a split REST API. Faster to ship, easier to follow.
- **SQLite locally, Postgres-ready.** The Prisma schema is provider-agnostic.
  Swap the datasource and it's a one-line change for production.
- **Analytics as pure functions.** `lib/analytics/*` takes plain trade objects
  and returns metrics. No DB coupling → trivially testable, easy to reuse
  client-side or in workers later.
- **Insights as rules, AI as ceiling.** Every rule produces an actionable
  insight without an API key. AI is the icing.
- **Cached P&L on the Trade row.** Reading the dashboard never re-derives P&L;
  it's computed at close time. Trade-off: a tiny bit of redundancy, massive
  read performance.
- **Money as Float for v0.1.** Production should migrate to Decimal — flagged
  in the schema comments. Not worth the friction at this stage.

---

## Roadmap

The schema and module layout were chosen so these can land incrementally
without big rewrites.

### Near term
- [ ] **CSV imports** — MT4/MT5 history, Binance trade history, IBKR flex
  query, generic CSV mapping
- [ ] **Multi-user auth** — NextAuth with email/OAuth; the `User` table is
  ready
- [ ] **Pre-trade checklist UI** — the `Checklist` model is wired; the form
  is the only piece missing
- [ ] **Trade screenshots** — drag-drop images into a trade; uploads to
  S3-compatible storage
- [ ] **Notifications** — daily loss limit hit, tilt warning, market open

### Mid term
- [ ] **Real-time market data** — TradingView Lightweight Charts on the trade
  detail page; broker WebSocket adapter for live prices
- [ ] **Economic calendar** — `EconomicEvent` model is in schema; ingest from
  ForexFactory / Finnhub
- [ ] **Backtesting** — given a strategy spec and historical bars, simulate
  trades and compare to actual performance
- [ ] **Browser extension** — overlay on TradingView / broker pages so the
  copilot runs *inside* the trader's existing tools
- [ ] **Mobile companion app** — view-only at first, then quick journal entry
- [ ] **Public profile / mentor sharing** — read-only link of your dashboard
  for a coach

### Long term
- [ ] **AI trade plan generator** — given a setup screenshot + thesis,
  suggest stop/target levels (with strict guardrails)
- [ ] **Multi-account portfolio view** — roll up across brokers
- [ ] **Tax-lot accounting** — for traders who need it
- [ ] **Plugin SDK** — let users write their own insight rules

---

## Tech stack

| Layer       | Choice                                |
|-------------|---------------------------------------|
| Framework   | Next.js 14 (App Router)               |
| Language    | TypeScript (strict)                   |
| ORM         | Prisma                                |
| DB          | SQLite (dev) / PostgreSQL (prod)      |
| Styling     | Tailwind CSS                          |
| Charts      | Recharts                              |
| Validation  | Zod                                   |
| AI          | `@anthropic-ai/sdk` (optional)        |
| Icons       | lucide-react                          |

---

## A note for the user

Not financial advice. This tool helps you trade *your own plan* with more
discipline — it can't pick winners for you. Trade with money you can afford to
lose, and never chase a loss.

If you find yourself revenge trading, closing the laptop is always the right
move. The copilot will still be here tomorrow. So will the markets.
