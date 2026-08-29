import { useEffect, useState } from "react";
import type { ProcessingStep } from "@/data/narrateiq";
import { MethodBadge } from "./primitives";

export function BriefLoading({
  kpiName,
  steps,
  onComplete,
}: {
  kpiName: string;
  steps: ProcessingStep[];
  onComplete: () => void;
}) {
  const [done, setDone] = useState(0);

  useEffect(() => {
    setDone(0);
    let cancelled = false;
    let index = 0;
    const run = () => {
      if (cancelled) return;
      if (index >= steps.length) {
        setTimeout(() => !cancelled && onComplete(), 450);
        return;
      }
      const step = steps[index]!;
      const ms = step.duration === "—" ? 200 : Math.round(parseFloat(step.duration) * 700);
      setTimeout(() => {
        if (cancelled) return;
        index += 1;
        setDone(index);
        run();
      }, ms);
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiName]);

  const progress = Math.round((done / steps.length) * 100);

  return (
    <div className="mx-auto max-w-[760px] px-6 py-14">
      <div className="border border-border bg-card p-8">
        <h1 className="font-serif text-[22px] font-bold tracking-tight text-foreground">
          Analysing {kpiName}
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          Steps 1–4 are deterministic and use no language model. Step 5 narrates findings already
          computed above.
        </p>

        <ul className="mt-7 divide-y divide-border border-y border-border">
          {steps.map((step, i) => {
            const complete = i < done;
            const active = i === done;
            const skipped = step.duration === "—";
            return (
              <li key={step.step} className="flex gap-3 py-3.5">
                <div className="mt-[3px] w-4 shrink-0">
                  {complete ? (
                    skipped ? (
                      <span className="text-[13px] text-muted-foreground">—</span>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--pos)" strokeWidth="3">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )
                  ) : active ? (
                    <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-primary" />
                  ) : (
                    <span className="block h-3.5 w-3.5 rounded-full border border-border" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={`text-[13.5px] ${active || complete ? "text-foreground" : "text-muted-foreground"}`}>
                      <span className="font-semibold">
                        Step {i + 1}: {step.step}
                      </span>
                      <span className="ml-2 font-mono text-[11.5px] text-muted-foreground">
                        {step.method}
                      </span>
                    </p>
                    <div className="flex items-center gap-3">
                      <MethodBadge type={step.type} />
                      <span className="w-8 text-right font-mono text-[11.5px] text-muted-foreground">
                        {step.duration}
                      </span>
                    </div>
                  </div>
                  {complete && (
                    <p
                      className={`mt-1 text-[12px] ${
                        skipped ? "text-muted-foreground" : "text-pos"
                      }`}
                    >
                      {step.result}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 h-[3px] w-full bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          {done} of {steps.length} steps complete
        </p>
      </div>
    </div>
  );
}
