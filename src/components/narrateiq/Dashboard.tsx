import { useMemo } from "react";

import { computeDashboard, fmtUsd } from "@/engine/metrics";
import { PERSONA_PROFILE, type Persona } from "@/engine/rbac";
import { rowCounts } from "@/engine/datasets";
import { SignalBadge, Sparkline, SIGNAL_STROKE } from "./primitives";

function freshnessClass(f: string) {
  if (f === "current") return "text-pos";
  if (f === "approaching") return "text-warn-foreground";
  return "text-signal-anomaly";
}

function LockIcon({ small }: { small?: boolean }) {
  const s = small ? 12 : 20;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="1" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function Dashboard({
  persona,
  onGenerate,
}: {
  persona: Persona;
  onGenerate: (id: string) => void;
}) {
  const cards = useMemo(() => computeDashboard(persona), [persona]);
  const rows = useMemo(() => rowCounts(), []);
  const profile = PERSONA_PROFILE[persona];
  const visible = cards.filter((c) => !c.locked);
  const anomalies = visible.filter((c) => c.snapshot.signal === "ANOMALY");
  const exposure = anomalies.reduce((acc, c) => acc + Math.abs(c.snapshot.businessImpactUsd), 0);
  const scanned = Object.values(rows).reduce((a, b) => a + b, 0);

  return (
    <div>
      {anomalies.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-l-4 border-l-signal-watch bg-warn px-6 py-3">
          <p className="text-[13px] font-medium text-warn-foreground">
            {anomalies.length} material {anomalies.length === 1 ? "movement" : "movements"} detected,{" "}
            {fmtUsd(exposure)} of exposure in scope for {profile.label}.
          </p>
          <a
            href={`#kpi-${anomalies[0]!.snapshot.id}`}
            className="text-[12px] font-semibold text-warn-foreground underline underline-offset-2"
          >
            Review
          </a>
        </div>
      )}

      <div className="mx-auto max-w-[1140px] px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-[24px] font-bold tracking-tight text-foreground">Monitored KPIs</h1>
            <p className="mt-1 max-w-[620px] text-[13px] text-muted-foreground">
              Every figure on this page is computed at load time from {scanned.toLocaleString()} source rows across
              six systems. Nothing is stored as a static result.
            </p>
          </div>
          <div className="text-right text-[11.5px] text-muted-foreground">
            <p>
              Showing {visible.length} of {cards.length} KPIs, entitlements enforced for {profile.label}.
            </p>
            <p className="mt-0.5">
              Scope: {profile.scope}. Clearance: {profile.clearance}.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {cards.map(({ snapshot, locked, lockReason }) => {
            const signal = locked ? "LOCKED" : snapshot.signal;
            const up = snapshot.changePct > 0;
            const good = snapshot.id === "returnRate" || snapshot.id === "cac" ? !up : up;
            const changeColor =
              snapshot.signal === "NOISE" ? "text-muted-foreground" : good ? "text-pos" : "text-neg";

            return (
              <div
                key={snapshot.id}
                id={`kpi-${snapshot.id}`}
                className={`relative flex flex-col border bg-card p-5 transition-shadow ${
                  locked ? "border-dashed border-border" : "border-border hover:shadow-[0_1px_12px_rgba(0,0,0,0.07)]"
                }`}
              >
                <div className={locked ? "pointer-events-none select-none blur-[5px]" : ""}>
                  <div className="flex items-center justify-between gap-2">
                    <SignalBadge signal={signal} />
                    <span className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
                      {snapshot.cadence}
                    </span>
                  </div>
                  <h3 className="mt-3 text-[15px] font-semibold leading-tight text-foreground">{snapshot.name}</h3>

                  <p className="mt-4 text-center font-serif text-[34px] font-bold leading-none tracking-tight text-foreground">
                    {snapshot.valueFormatted}
                  </p>
                  <p className={`mt-2 text-center text-[13px] font-semibold ${changeColor}`}>
                    {up ? "▲" : "▼"} {Math.abs(snapshot.changePct).toFixed(1)}%
                    <span className="ml-1 font-normal text-muted-foreground">vs {snapshot.baselineWindow}</span>
                  </p>

                  <div className="mt-3">
                    <Sparkline
                      data={snapshot.sparkline}
                      color={SIGNAL_STROKE[signal] ?? "currentColor"}
                      dashed={snapshot.signal === "SPARSE"}
                    />
                    {snapshot.signal === "SPARSE" && (
                      <p className="mt-1 text-[11px] italic text-muted-foreground">
                        {snapshot.historyPoints} observations available. Baseline not yet established.
                      </p>
                    )}
                  </div>

                  <div className="mt-3 border-t border-border pt-3 text-[11.5px]">
                    <p className={freshnessClass(snapshot.freshness)}>
                      {snapshot.source} · last loaded {snapshot.lastUpdated}
                    </p>
                    <p className="mt-1 text-foreground">
                      {snapshot.zScore === null
                        ? "Robust z score: indeterminate, insufficient history"
                        : `z = ${snapshot.zScore} · materiality ${snapshot.materiality} · ${fmtUsd(Math.abs(snapshot.businessImpactUsd))}`}
                    </p>
                    <p className="mt-1 italic text-muted-foreground">{snapshot.detectionMethod}</p>
                  </div>
                </div>

                {locked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-6 text-center">
                    <LockIcon />
                    <span className="text-[12px] font-semibold text-muted-foreground">Access restricted</span>
                    <span className="text-[11px] text-muted-foreground">{lockReason}</span>
                  </div>
                )}

                <div className="mt-4">
                  {locked ? (
                    <button
                      disabled
                      className="flex w-full cursor-not-allowed items-center justify-center gap-2 border border-border bg-secondary px-3 py-2 text-[12px] font-semibold text-muted-foreground"
                    >
                      <LockIcon small /> Entitlement required
                    </button>
                  ) : snapshot.signal === "NOISE" ? (
                    <button
                      onClick={() => onGenerate(snapshot.id)}
                      className="w-full border border-border bg-secondary px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:border-primary hover:text-primary"
                    >
                      No action required. See why
                    </button>
                  ) : snapshot.signal === "SPARSE" ? (
                    <button
                      onClick={() => onGenerate(snapshot.id)}
                      className="w-full bg-signal-sparse px-3 py-2 text-[12px] font-semibold text-white hover:opacity-90"
                    >
                      View abstention brief
                    </button>
                  ) : (
                    <button
                      onClick={() => onGenerate(snapshot.id)}
                      className="w-full bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Generate decision brief
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
