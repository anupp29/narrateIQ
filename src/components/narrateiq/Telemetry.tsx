import { useMemo } from "react";

import { rowCounts } from "@/engine/datasets";
import { detectionQuality, driftReport } from "@/engine/drift";
import { computeDashboard, fmtUsd } from "@/engine/metrics";
import { runBrief } from "@/engine/pipeline";
import { readAudit, PERSONA_PROFILE, type Persona } from "@/engine/rbac";
import { CAPABILITY_REGISTER } from "@/engine/semantic";
import { SectionHeading } from "./primitives";

export function Telemetry({ persona, onBack }: { persona: Persona; onBack: () => void }) {
  const runs = useMemo(() => {
    const cards = computeDashboard(persona).filter((c) => !c.locked);
    return cards.map((c) => {
      const brief = runBrief(c.snapshot.id, persona);
      return {
        kpi: brief.kpiName,
        outcome: brief.kind,
        signal: brief.snapshot.signal,
        computeMs: brief.telemetry.computeMs,
        rows: brief.telemetry.rowsScanned,
        modelCalled: brief.kind === "BRIEF" && brief.snapshot.signal !== "NOISE",
        routeReason: brief.telemetry.routeReason,
        impact: Math.abs(brief.snapshot.businessImpactUsd),
      };
    });
  }, [persona]);

  const drift = useMemo(() => driftReport(), []);
  const quality = useMemo(() => detectionQuality(), []);
  const audit = readAudit().slice(-8).reverse();
  const rows = rowCounts();
  const totalRows = Object.values(rows).reduce((a, b) => a + b, 0);
  const modelRuns = runs.filter((r) => r.modelCalled).length;
  const profile = PERSONA_PROFILE[persona];

  return (
    <div className="mx-auto max-w-[1040px] px-6 py-8">
      <button onClick={onBack} className="text-[12px] text-muted-foreground hover:text-primary">
        Back to dashboard
      </button>
      <h1 className="mt-3 font-serif text-[26px] font-bold tracking-tight text-foreground">
        System telemetry and model health
      </h1>
      <p className="mt-1.5 max-w-[720px] text-[13px] text-muted-foreground">
        Cost, latency, entitlement decisions and input stability for the current session. Everything below is measured
        from executed runs in this browser session, viewed as {profile.label}.
      </p>

      <section className="mt-8">
        <SectionHeading index="01" title="Cost and latency per insight" />
        <div className="overflow-x-auto border border-border">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-secondary text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-3 py-2 font-semibold">KPI</th>
                <th className="px-3 py-2 font-semibold">Outcome</th>
                <th className="px-3 py-2 font-semibold">Compute</th>
                <th className="px-3 py-2 font-semibold">Rows read</th>
                <th className="px-3 py-2 font-semibold">Model reached</th>
                <th className="px-3 py-2 font-semibold">Routing decision</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.kpi} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium text-foreground">{r.kpi}</td>
                  <td className="px-3 py-2">
                    {r.outcome} · {r.signal}
                  </td>
                  <td className="px-3 py-2 font-mono">{r.computeMs} ms</td>
                  <td className="px-3 py-2 font-mono">{r.rows.toLocaleString()}</td>
                  <td className={`px-3 py-2 font-semibold ${r.modelCalled ? "text-warn-foreground" : "text-pos"}`}>
                    {r.modelCalled ? "Yes" : "No"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.routeReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-foreground">
          {modelRuns} of {runs.length} monitored KPIs would reach a language model on this run. Movements classified
          as noise and every abstention are resolved before narration, which is where the operating cost of a
          narrative platform is normally lost.
        </p>
      </section>

      <section className="mt-9">
        <SectionHeading index="02" title="Input stability" />
        <div className="overflow-x-auto border border-border">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-secondary text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Input</th>
                <th className="px-3 py-2 font-semibold">Population stability index</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Interpretation</th>
              </tr>
            </thead>
            <tbody>
              {drift.map((d) => (
                <tr key={d.input} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium text-foreground">{d.input}</td>
                  <td className="px-3 py-2 font-mono">{d.psi}</td>
                  <td
                    className={`px-3 py-2 font-semibold ${
                      d.status === "stable" ? "text-pos" : d.status === "watch" ? "text-warn-foreground" : "text-neg"
                    }`}
                  >
                    {d.status}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{d.interpretation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-9">
        <SectionHeading index="03" title="Detection quality" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Alerts judged", value: `${quality.analystConfirmed + quality.analystRejected}` },
            { label: "Confirmed", value: `${quality.analystConfirmed}` },
            { label: "Rejected", value: `${quality.analystRejected}` },
            { label: "Precision", value: quality.precision === null ? "not yet available" : `${quality.precision}` },
          ].map((s) => (
            <div key={s.label} className="border border-border bg-card p-3">
              <p className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">{s.label}</p>
              <p className="mt-1 font-serif text-[22px] font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-foreground">{quality.note}</p>
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Baseline window: {quality.baselineWindow}. Last threshold recalibration: {quality.lastRecalibration}.
        </p>
      </section>

      <section className="mt-9">
        <SectionHeading index="04" title="Access log" />
        {audit.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">
            No access decisions recorded yet in this session. Open a brief and the entitlement evaluation will appear
            here.
          </p>
        ) : (
          <div className="overflow-x-auto border border-border">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-secondary text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Time</th>
                  <th className="px-3 py-2 font-semibold">Actor</th>
                  <th className="px-3 py-2 font-semibold">Resource</th>
                  <th className="px-3 py-2 font-semibold">Decision</th>
                  <th className="px-3 py-2 font-semibold">Rule</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a, i) => (
                  <tr key={`${a.at}-${i}`} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{a.at.slice(11, 19)}</td>
                    <td className="px-3 py-2">{a.actor}</td>
                    <td className="px-3 py-2">{a.action} · {a.object}</td>
                    <td className={`px-3 py-2 font-semibold ${a.decision === "ALLOW" ? "text-pos" : "text-neg"}`}>
                      {a.decision}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{a.rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-9">
        <SectionHeading index="05" title="Capability register" />
        <div className="overflow-x-auto border border-border">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-secondary text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Capability</th>
                <th className="px-3 py-2 font-semibold">Classification</th>
                <th className="px-3 py-2 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody>
              {CAPABILITY_REGISTER.map((c) => (
                <tr key={c.capability} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium text-foreground">{c.capability}</td>
                  <td className="px-3 py-2">{c.classification}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11.5px] text-muted-foreground">
          Corpus in use: {totalRows.toLocaleString()} rows across {Object.keys(rows).length} extracts, worth{" "}
          {fmtUsd(
            runs.reduce((acc, r) => acc + r.impact, 0),
          )}{" "}
          of monitored movement in the current persona scope.
        </p>
      </section>
    </div>
  );
}
