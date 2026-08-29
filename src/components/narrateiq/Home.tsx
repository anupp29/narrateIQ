const PILLARS = [
  {
    k: "01",
    t: "Detect what matters",
    d: "Robust z-scores and CUSUM on governed KPI contracts. Immaterial movement is labelled noise and never narrated.",
  },
  {
    k: "02",
    t: "Explain without guessing",
    d: "Dimensional drill-down, regression attribution and a refutation battery rank drivers before any language model runs.",
  },
  {
    k: "03",
    t: "Abstain on thin evidence",
    d: "Sparse history or contradictory sources return a stated gap and a data request, not a confident story.",
  },
  {
    k: "04",
    t: "Assign the action",
    d: "Each brief ends with a named owner, a due date and the monitoring metric that closes the loop.",
  },
];

const PROOF = [
  { v: "6", l: "Source extracts reconciled to a common grain" },
  { v: "4", l: "Deterministic stages before narration" },
  { v: "0", l: "Model cost on noise and abstention" },
  { v: "100%", l: "Narrated figures checked against computed values" },
];

export function Home({ onEnter }: { onEnter: () => void }) {
  return (
    <div>
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1240px] px-6 py-20 md:py-28">
          <div className="grid gap-12 md:grid-cols-[1.15fr_1fr] md:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                KPI intelligence to action engine
              </p>
              <h1 className="mt-4 max-w-[18ch] font-serif text-[42px] font-bold leading-[1.05] tracking-tight text-foreground md:text-[58px]">
                From a moving number to an owned decision.
              </h1>
              <p className="mt-6 max-w-[58ch] text-[15px] leading-relaxed text-muted-foreground">
                NarrateIQ reads source system extracts, proves whether a KPI movement is material,
                ranks the drivers with statistical methods, and issues a persona specific brief with
                an owner, a deadline and a monitoring plan. Language is the last step, not the logic.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  onClick={onEnter}
                  className="bg-primary px-6 py-3 text-[13px] font-semibold tracking-wide text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Sign in to the console
                </button>
                <span className="text-[12px] text-muted-foreground">
                  Two personas. Four scenarios. Deterministic every run.
                </span>
              </div>
            </div>

            <div className="border border-border bg-secondary/60 p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Pipeline
              </p>
              <ol className="mt-4 space-y-3">
                {[
                  ["Signal validation", "NON-LLM"],
                  ["Dimensional drill-down", "NON-LLM"],
                  ["Causal ranking and refutation", "NON-LLM"],
                  ["Action assignment", "NON-LLM"],
                  ["Narration under numeric guard", "LLM"],
                ].map(([step, tag]) => (
                  <li key={step} className="flex items-center justify-between gap-4 border-b border-border pb-2 last:border-0">
                    <span className="text-[13px] text-foreground">{step}</span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] ${
                        tag === "LLM"
                          ? "bg-primary/10 text-primary"
                          : "bg-background text-muted-foreground"
                      }`}
                    >
                      {tag}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-px bg-border md:grid-cols-4">
          {PROOF.map((p) => (
            <div key={p.l} className="bg-background px-6 py-8">
              <p className="font-serif text-[32px] font-bold leading-none text-foreground">{p.v}</p>
              <p className="mt-2 text-[12px] leading-snug text-muted-foreground">{p.l}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-6 py-16">
        <h2 className="font-serif text-[26px] font-bold tracking-tight text-foreground">
          How the engine reaches a decision
        </h2>
        <div className="mt-8 grid gap-px bg-border md:grid-cols-4">
          {PILLARS.map((p) => (
            <div key={p.k} className="bg-background p-6">
              <span className="text-[11px] font-semibold tracking-[0.16em] text-primary">{p.k}</span>
              <h3 className="mt-3 text-[15px] font-semibold text-foreground">{p.t}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-6 px-6 py-10">
          <p className="max-w-[52ch] text-[14px] text-foreground">
            Sign in as a CFO or a Regional Sales Manager. Entitlements are applied before data is
            read, and every inference call is logged with its latency and cost.
          </p>
          <button
            onClick={onEnter}
            className="ml-auto border border-primary px-6 py-3 text-[13px] font-semibold tracking-wide text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Continue
          </button>
        </div>
      </section>
    </div>
  );
}
