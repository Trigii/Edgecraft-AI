"use client";

import { useState, useTransition } from "react";
import { runAiAsk, runAiWeeklyReview } from "@/app/actions/ai";
import { Sparkles, Send } from "lucide-react";

export function AiReviewBlock() {
  const [pending, start] = useTransition();
  const [review, setReview] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string>("");
  const [askPending, askStart] = useTransition();

  function review_() {
    start(async () => {
      try {
        setErr("");
        const r = await runAiWeeklyReview();
        setReview(r);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    });
  }
  function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    askStart(async () => {
      try {
        setErr("");
        const r = await runAiAsk(q);
        setAnswer(r);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className="card border-edge/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-edge" />
            <span className="font-medium text-sm">Weekly review</span>
          </div>
          <button onClick={review_} disabled={pending} className="btn-ghost text-xs">
            {pending ? "Thinking…" : review ? "Regenerate" : "Generate"}
          </button>
        </div>
        {review && <div className="mt-3 whitespace-pre-wrap text-sm text-ink-muted leading-relaxed">{review}</div>}
      </div>

      <form onSubmit={ask} className="card border-edge/30 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-edge" />
          <span className="font-medium text-sm">Ask the copilot</span>
        </div>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Where am I losing money? What's my biggest mistake?"
            className="flex-1"
          />
          <button type="submit" disabled={askPending} className="btn-primary">
            <Send size={14} />
          </button>
        </div>
        {answer && <div className="whitespace-pre-wrap text-sm text-ink-muted leading-relaxed">{answer}</div>}
        {err && <div className="text-bear text-xs">{err}</div>}
      </form>
    </div>
  );
}
