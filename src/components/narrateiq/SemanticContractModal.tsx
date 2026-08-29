import { useState } from "react";

import { KPI_CONTRACTS, KPI_ORDER } from "@/engine/semantic";

export function SemanticContractModal({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState(KPI_ORDER[0]!);
  const contract = KPI_CONTRACTS[active]!;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-4 py-10"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[860px] border border-border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-[22px] font-bold tracking-tight text-foreground">
              KPI semantic contract
            </h2>
            <p className="mt-1 max-w-[560px] text-[12.5px] text-muted-foreground">
              One governed definition per KPI. Detection, decomposition and narration all read from this contract, so
              a metric cannot mean two things in two places.
            </p>
          </div>
          <button onClick={onClose} className="text-[12px] text-primary underline underline-offset-2">
            Close
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {KPI_ORDER.map((id) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`border px-3 py-1.5 text-[12px] font-semibold ${
                id === active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary text-foreground hover:border-primary"
              }`}
            >
              {KPI_CONTRACTS[id]!.name}
            </button>
          ))}
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 text-[12.5px] sm:grid-cols-2">
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">Definition</dt>
            <dd className="text-foreground">{contract.definition}</dd>
          </div>
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">Formula</dt>
            <dd className="font-mono text-[11.5px] text-foreground">{contract.formula}</dd>
          </div>
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">Grain and calendar</dt>
            <dd className="text-foreground">
              {contract.grain}. {contract.reportingCalendar}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">Accountable owner</dt>
            <dd className="text-foreground">{contract.ownerRole}</dd>
          </div>
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">Thresholds</dt>
            <dd className="text-foreground">
              Watch at z {contract.thresholds.zWatch}, anomaly at z {contract.thresholds.zAnomaly}, materiality at $
              {contract.thresholds.materialImpactUsd.toLocaleString()}, minimum history{" "}
              {contract.thresholds.minHistoryPoints} observations.
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">Entitlement</dt>
            <dd className="text-foreground">
              {contract.entitlements.classification}, domain {contract.entitlements.domain}, visible to{" "}
              {contract.entitlements.visibleTo.join(" and ")}.
            </dd>
          </div>
        </dl>

        {contract.knownConflicts && (
          <p className="mt-4 border-l-4 border-l-signal-watch bg-warn px-4 py-2.5 text-[12.5px] text-warn-foreground">
            Known conflict: {contract.knownConflicts}
          </p>
        )}

        <div className="mt-5">
          <p className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">Lineage</p>
          <div className="mt-2 space-y-2">
            {contract.lineage.map((n) => (
              <div key={n.id} className="border border-border bg-secondary/50 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12.5px] font-semibold text-foreground">{n.label}</p>
                  <span className="border border-border px-1.5 py-[1px] text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    {n.kind} · {n.capability}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] text-muted-foreground">{n.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">Source systems</p>
          <ul className="mt-2 space-y-1">
            {contract.sources.map((s) => (
              <li key={s.dataset} className="text-[12px] text-foreground">
                {s.system} · {s.dataset} · {s.grain} · {s.cadence} · SLA {s.slaHours} h · {s.qualityNotes}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
