import Link from "next/link";
import { ArrowRight, Bot, Shield, LineChart, Zap, BookOpen, Calculator } from "lucide-react";

export default function Landing() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-bg-border bg-bg-surface/50 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-edge flex items-center justify-center text-bg font-bold">E</div>
            <div>
              <div className="font-semibold">Edgecraft AI</div>
              <div className="text-[10px] uppercase tracking-widest text-ink-subtle">Trading copilot</div>
            </div>
          </div>
          <Link href="/dashboard" className="btn-primary">
            Open app <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="badge-muted mb-4">v0.1 · Built for traders who want to keep their account</div>
        <h1 className="text-5xl font-semibold tracking-tight leading-tight">
          The copilot that <span className="text-edge">protects your account</span><br />before it grows it.
        </h1>
        <p className="text-ink-muted mt-6 text-lg max-w-2xl mx-auto">
          Every trade gets pre-flight checks. Every loss becomes data. Every pattern in your
          behavior gets surfaced — so you stop making the same mistake twice.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/dashboard" className="btn-primary px-5 py-3 text-base">
            Open the dashboard <ArrowRight size={16} />
          </Link>
          <Link href="/copilot" className="btn-ghost px-5 py-3 text-base">
            Try the pre-trade copilot
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-4">
        <Feature
          icon={Bot}
          title="Pre-trade copilot"
          body="Before you click buy: validates R:R, position size, stop loss, daily loss limit, and tilt. Blocks the trades that blow accounts."
        />
        <Feature
          icon={LineChart}
          title="Analytics that matter"
          body="Equity curve, drawdown, Sharpe, profit factor, expectancy in R-multiples. Stats by symbol, hour, day, strategy, emotion."
        />
        <Feature
          icon={Shield}
          title="Behavioral patterns"
          body="Auto-detects revenge trading, overtrading, cutting winners short. Names the leak before it drains the account."
        />
        <Feature
          icon={BookOpen}
          title="Disciplined journal"
          body="Mandatory thesis, optional checklist, screenshots, post-mortems. Tag mistakes. Search by anything."
        />
        <Feature
          icon={Calculator}
          title="Position sizing"
          body="Risk-based sizing in one input. Refuses to let you over-leverage. Works for forex, stocks, crypto, futures."
        />
        <Feature
          icon={Zap}
          title="AI insights (optional)"
          body="Drop in an Anthropic key to unlock qualitative weekly reviews and natural-language Q&A about your performance."
        />
      </section>

      <footer className="border-t border-bg-border py-6 text-center text-xs text-ink-subtle">
        Edgecraft AI · Not financial advice. Trade with money you can afford to lose.
      </footer>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Bot;
  title: string;
  body: string;
}) {
  return (
    <div className="card">
      <Icon size={20} className="text-edge" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="text-sm text-ink-muted mt-1">{body}</p>
    </div>
  );
}
