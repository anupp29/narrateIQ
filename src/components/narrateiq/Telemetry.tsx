import { TELEMETRY_LOG, type Persona } from "@/data/narrateiq";

function latencyClass(ms: number) {
  if (ms < 3000) return "text-pos";
  if (ms <= 6000) return "text-warn-foreground";
  return "text-signal-anomaly";
}

export function Telemetry({ persona, onBack }: { persona: Persona; onBack: () => void }) {
  if (persona !== "CFO") {
    return (
      <div className="mx-auto max-w-[760px] px-6 py-16">
        <button onClick={onBack} className="text-[12px] text-primary underline underline-offset-2">
          ← Back to dashboard
        </button>
        <div className="mt-5 flex flex-col items-center gap-3 border border-dashed border-border bg-card px-6 py-16 text-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
            <rect x="3" y="11" width="18" height="11" rx="1" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p className="text-[14px] font-semibold text-foreground">
            Access restricted. CFO entitlement required
          </p>
          <p className="max-w-sm text-[12.5px] text-muted-foreground">
            System telemetry contains cost and model-tier data outside your entitlement. This access
            attempt has been logged.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1040px] px-6 py-8">
      <button onClick={onBack} className="text-[12px] text-primary underline underline-offset-2">
        ← Back to dashboard
      </button>
      <h1 className="mt-4 font-serif text-[24px] font-bold tracking-tight text-foreground">
        System Telemetry
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        All LLM calls logged. Cost calculated per insight. Abstention and noise signals incur zero
        LLM cost.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Briefs generated today", value: "3" },
          { label: "Average latency", value: "4,867ms" },
          { label: "Total LLM cost today", value: "$0.012" },
        ].map((s) => (
          <div key={s.label} className="border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{s.label}</p>
            <p className="mt-2 font-serif text-[26px] font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 border-l-4 border-l-pos bg-pos/5 px-4 py-3 text-[12.5px] text-foreground">
        3 of 10 requests incurred zero LLM cost, routed to abstention or noise classification before
        narrative generation.
      </div>

      <div className="mt-6 overflow-x-auto border border-border">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-secondary text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="px-3 py-2 font-semibold">Timestamp</th>
              <th className="px-3 py-2 font-semibold">KPI</th>
              <th className="px-3 py-2 font-semibold">Persona</th>
              <th className="px-3 py-2 font-semibold">Model tier</th>
              <th className="px-3 py-2 text-right font-semibold">Tokens</th>
              <th className="px-3 py-2 text-right font-semibold">Latency (ms)</th>
              <th className="px-3 py-2 text-right font-semibold">Cost</th>
            </tr>
          </thead>
          <tbody>
            {TELEMETRY_LOG.map((row, i) => {
              const zero = row.tokens === 0;
              return (
                <tr
                  key={i}
                  className={`border-t border-border ${zero ? "bg-pos/5" : i % 2 ? "bg-secondary/40" : ""}`}
                >
                  <td className="px-3 py-2 font-mono text-[11.5px] text-muted-foreground">
                    {row.timestamp}
                  </td>
                  <td className="px-3 py-2 text-foreground">{row.kpi}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.persona}</td>
                  <td className="px-3 py-2 text-foreground">{row.model}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {zero ? (
                      <span className="text-muted-foreground">0 (no LLM triggered)</span>
                    ) : (
                      row.tokens
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${latencyClass(row.latency)}`}>
                    {row.latency.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{row.cost}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11.5px] italic text-muted-foreground">
        Model tier shown as "Sonnet" or "Haiku": complex briefs use higher-capability tier, simpler
        briefs are routed to cost-optimised tier.
      </p>
    </div>
  );
}
