"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { runAiPostMortem } from "@/app/actions/ai";

export function AiPostMortem({
  trade,
}: {
  trade: {
    id: string;
    symbol: string;
    direction: string;
    pnl: number;
    rMultiple: number | null;
    thesis: string | null;
    notes: string | null;
    outcome: string | null;
  };
}) {
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  async function ask() {
    setLoading(true);
    setError("");
    try {
      const text = await runAiPostMortem(trade);
      setResponse(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to call AI");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card border-edge/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-edge" />
          <span className="text-sm font-medium">AI post-mortem</span>
        </div>
        <button onClick={ask} disabled={loading} className="btn-ghost text-xs">
          {loading ? "Thinking…" : response ? "Re-ask" : "Ask the copilot"}
        </button>
      </div>
      {error && <div className="text-bear text-xs mt-2">{error}</div>}
      {response && (
        <div className="mt-3 whitespace-pre-wrap text-sm text-ink-muted leading-relaxed">{response}</div>
      )}
    </div>
  );
}
