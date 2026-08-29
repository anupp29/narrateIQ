import { KPI_DATA, KPI_ORDER, type Kpi, type Persona } from "@/data/narrateiq";
import { SignalBadge, Sparkline, SIGNAL_STROKE } from "./primitives";

const ORDER_RANK: Record<string, number> = {
  ANOMALY: 0,
  WATCH: 1,
  NOISE: 2,
  SPARSE: 3,
};

function freshnessClass(f: string) {
  if (f === "current") return "text-pos";
  if (f === "approaching") return "text-warn-foreground";
  return "text-signal-anomaly";
}

function KpiCard({
  kpi,
  locked,
  onGenerate,
}: {
  kpi: Kpi;
  locked: boolean;
  onGenerate: (id: string) => void;
}) {
  const signal = locked ? "LOCKED" : kpi.signal;
  const changePositive = kpi.change > 0;
  const changeColor =
    kpi.signal === "NOISE"
      ? "text-muted-foreground"
      : (kpi.id === "revenue" || kpi.id === "aov" || kpi.id === "newMarket") === changePositive
        ? "text-pos"
        : "text-neg";

  return (
    <div
      id={`kpi-${kpi.id}`}
      className={`relative flex flex-col border bg-card p-5 transition-shadow ${
        locked ? "border-dashed border-border" : "border-border hover:shadow-[0_1px_12px_rgba(0,0,0,0.07)]"
      }`}
    >
      <div className={locked ? "pointer-events-none select-none blur-[5px]" : ""}>
        <SignalBadge signal={signal} />
        <h3 className="mt-3 text-[15px] font-semibold leading-tight text-foreground">{kpi.name}</h3>

        <p className="mt-4 text-center font-serif text-[34px] font-bold leading-none tracking-tight text-foreground">
          {kpi.valueFormatted}
        </p>
        <p className={`mt-2 text-center text-[13px] font-semibold ${changeColor}`}>
          {changePositive ? "▲" : "▼"} {Math.abs(kpi.change).toFixed(1)}%
          <span className="ml-1 font-normal text-muted-foreground">vs baseline</span>
        </p>

        <div className="mt-3">
          <Sparkline
            data={kpi.sparkline}
            color={SIGNAL_STROKE[signal] ?? "currentColor"}
            dashed={kpi.signal === "SPARSE"}
          />
          {kpi.signal === "SPARSE" && (
            <p className="mt-1 text-[11px] italic text-muted-foreground">
              6 months of data — baseline not yet established
            </p>
          )}
        </div>

        <div className="mt-3 border-t border-border pt-3 text-[11.5px]">
          <p className={freshnessClass(kpi.freshness)}>
            {kpi.source} ·{" "}
            {kpi.id === "newMarket"
              ? "Updated 12 days ago — monthly cadence"
              : `Updated ${kpi.lastUpdated}`}
          </p>
          <p className="mt-1 text-foreground">
            {kpi.signal === "SPARSE"
              ? "z-score: indeterminate — insufficient history"
              : kpi.signal === "NOISE"
                ? `z = ${kpi.zScore} · Within normal variance`
                : `z = ${kpi.zScore} · Materiality: ${kpi.materiality}`}
          </p>
          <p className="mt-1 italic text-muted-foreground">
            {kpi.signal === "SPARSE"
              ? "Detection: Not applicable — 6 of 24 required data points available"
              : `Detected by: ${kpi.detectionMethod}`}
          </p>
        </div>
      </div>

      {locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <LockIcon />
          <span className="text-[12px] font-semibold text-muted-foreground">Access restricted</span>
        </div>
      )}

      <div className="mt-4">
        {locked ? (
          <button
            disabled
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 border border-border bg-secondary px-3 py-2 text-[12px] font-semibold text-muted-foreground"
          >
            <LockIcon small /> Access restricted — CFO entitlement required
          </button>
        ) : kpi.signal === "NOISE" ? (
          <button
            disabled
            className="w-full cursor-not-allowed border border-border bg-secondary px-3 py-2 text-[12px] font-semibold text-muted-foreground"
          >
            No action required
          </button>
        ) : kpi.signal === "SPARSE" ? (
          <button
            onClick={() => onGenerate(kpi.id)}
            className="w-full bg-signal-sparse px-3 py-2 text-[12px] font-semibold text-white hover:opacity-90"
          >
            View Abstention Brief →
          </button>
        ) : (
          <button
            onClick={() => onGenerate(kpi.id)}
            className="w-full bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Generate Decision Brief →
          </button>
        )}
      </div>
    </div>
  );
}

function LockIcon({ small }: { small?: boolean }) {
  const s = small ? 12 : 20;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
  const kpis = KPI_ORDER.map((id) => KPI_DATA[id]!).sort((a, b) => {
    const la = a.accessRoles.includes(persona) ? 0 : 1;
    const lb = b.accessRoles.includes(persona) ? 0 : 1;
    if (la !== lb) return la - lb;
    return (ORDER_RANK[a.signal] ?? 9) - (ORDER_RANK[b.signal] ?? 9);
  });

  const anomalies = kpis.filter((k) => k.accessRoles.includes(persona) && k.signal === "ANOMALY");
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      {anomalies.length > 0 && (
        <div className="flex items-center justify-between border-l-4 border-l-signal-watch bg-warn px-6 py-3">
          <p className="text-[13px] font-medium text-warn-foreground">
            {anomalies.length} material {anomalies.length === 1 ? "anomaly" : "anomalies"} detected
            requiring attention — {now}
          </p>
          <a
            href={`#kpi-${anomalies[0]!.id}`}
            className="text-[12px] font-semibold text-warn-foreground underline underline-offset-2"
          >
            Review →
          </a>
        </div>
      )}

      <div className="mx-auto max-w-[1140px] px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-serif text-[24px] font-bold tracking-tight text-foreground">
              Monitored KPIs
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Prioritised by signal severity. Every card shows its source system, cadence and
              detection method.
            </p>
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            Showing {kpis.filter((k) => k.accessRoles.includes(persona)).length} of {kpis.length}{" "}
            KPIs · entitlements enforced for {persona}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.id}
              kpi={kpi}
              locked={!kpi.accessRoles.includes(persona)}
              onGenerate={onGenerate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
