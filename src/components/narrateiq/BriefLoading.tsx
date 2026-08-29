import { useEffect, useState } from "react";

import type { StepTrace } from "@/engine/types";
import { MethodBadge } from "./primitives";

/**
 * Replays the trace the engine actually produced. The step names, methods and
 * timings are read from the executed run, not scripted for the demo.
 */
export function BriefLoading({
  kpiName,
  steps,
  onComplete,
}: {
  kpiName: string;
  steps: StepTrace[];
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= steps.length) {
      const done = setTimeout(onComplete, 260);
      return () => clearTimeout(done);
    }
    const t = setTimeout(() => setIndex((i) => i + 1), 380);
    return () => clearTimeout(t);
  }, [index, steps.length, onComplete]);

  const nonLlm = steps.filter((s) => s.type === "NON-LLM").length;

  return (
    <div className="mx-auto max-w-[720px] px-6 py-16">
      <p className="text-[11.5px] uppercase tracking-[0.1em] text-muted-foreground">Running analysis</p>
      <h1 className="mt-1.5 font-serif text-[24px] font-bold tracking-tight text-foreground">{kpiName}</h1>
      <p className="mt-2 text-[12.5px] text-muted-foreground">
        {nonLlm} of {steps.length} steps are deterministic. The language model is only reached, if at all, in the
        final step.
      </p>

      <ol className="mt-6 space-y-2">
        {steps.map((s, i) => {
          const state = i < index ? "done" : i === index ? "active" : "pending";
          return (
            <li
              key={s.step}
              className={`border p-3 transition-opacity ${
                state === "pending" ? "border-border opacity-40" : "border-border opacity-100"
              } ${state === "active" ? "border-l-[3px] border-l-primary bg-secondary/50" : "bg-card"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-foreground">
                  {state === "done" ? "✓ " : state === "active" ? "› " : ""}
                  {s.step}
                </p>
                <div className="flex items-center gap-2">
                  <MethodBadge type={s.type} />
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {s.skipped ? "not called" : `${s.durationMs} ms`}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{s.method}</p>
              {state === "done" && <p className="mt-1.5 text-[12px] leading-snug text-foreground">{s.result}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
