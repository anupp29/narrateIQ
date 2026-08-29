import { useState } from "react";
import { SEMANTIC_CONTRACT } from "@/data/narrateiq";

export function SemanticContractModal({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<string | null>("revenue");

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-4 py-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[700px] border border-border bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div>
            <h2 className="font-serif text-[20px] font-bold tracking-tight text-foreground">
              KPI Semantic Contract
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              Governed definitions, lineage, calculations, access controls and thresholds for all
              monitored KPIs. This layer is deterministic — no LLM involvement.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="bg-muted px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground">
              NON-LLM — Deterministic definition layer
            </span>
            <button onClick={onClose} className="text-[12px] text-primary underline underline-offset-2">
              Close
            </button>
          </div>
        </div>

        <div className="divide-y divide-border">
          {SEMANTIC_CONTRACT.map((k) => {
            const expanded = open === k.id;
            return (
              <div key={k.id}>
                <button
                  onClick={() => setOpen(expanded ? null : k.id)}
                  className="flex w-full items-center justify-between px-6 py-3 text-left hover:bg-secondary/60"
                >
                  <span className="text-[13.5px] font-semibold text-foreground">{k.name}</span>
                  <span className="text-[12px] text-muted-foreground">{expanded ? "−" : "+"}</span>
                </button>
                {expanded && (
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 bg-secondary/40 px-6 pb-5 pt-1 text-[12.5px] sm:grid-cols-2">
                    <Row label="Definition" value={k.definition} full />
                    <Row label="Formula" value={k.formula} mono full />
                    <Row label="Source lineage" value={k.lineage} mono full />
                    <Row label="Refresh cadence" value={k.cadence} />
                    <Row label="Data owner" value={k.owner} />
                    <Row label="Materiality thresholds" value={k.thresholds} full />
                    <Row label="Access roles" value={k.accessRoles.join(", ")} />
                    <Row label="Last updated" value={k.lastUpdated} />
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  full,
}: {
  label: string;
  value: string;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-0.5 leading-relaxed text-foreground ${mono ? "font-mono text-[11.5px]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
