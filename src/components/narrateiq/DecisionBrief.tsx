import { useState } from "react";

import { fmtUsd } from "@/engine/metrics";
import { recordFeedback } from "@/engine/feedback";
import type { NarrationResult } from "@/lib/narrate.functions";
import type {
  AbstentionResult,
  BriefResult,
  DecisionBriefResult,
  DriverFinding,
  EvidenceItem,
} from "@/engine/types";
import { ConfidenceBadge, FreshnessDot, MethodBadge, SectionHeading, SignalBadge } from "./primitives";

function materialityClass(m: string) {
  if (m.includes("HIGH")) return "text-signal-anomaly font-semibold";
  if (m.includes("MEDIUM")) return "text-warn-foreground font-semibold";
  return "text-muted-foreground";
}

function EvidenceList({ items }: { items: EvidenceItem[] }) {
  if (!items.length) {
    return <p className="text-[12px] italic text-muted-foreground">No qualifying evidence passed the relevance floor.</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((e) => (
        <div key={e.noteId} className="border-b border-border pb-2 last:border-0 last:pb-0">
          <p className="text-[12.5px] leading-relaxed text-foreground">{e.text}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {e.source} · {e.noteId} · {e.authorRole} · {e.date} · relevance {e.score}
          </p>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-muted-foreground">
        Retrieved by term frequency inverse document frequency ranking over CRM notes and support tickets. No model
        was involved in this retrieval.
      </p>
    </div>
  );
}

function DriverCard({ driver, rank }: { driver: DriverFinding; rank: number }) {
  const [open, setOpen] = useState(false);
  const width = Math.min(100, Math.abs(driver.contributionPct));
  const barColor = driver.rejected ? "bg-muted" : driver.confidence === "HIGH" ? "bg-pos" : "bg-signal-watch";

  return (
    <div className="border border-border bg-card p-4">
      <div className="flex gap-4">
        <span className="font-serif text-[22px] font-bold leading-none text-muted-foreground/50">
          {String(rank).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4
              className={`text-[14.5px] font-semibold text-foreground ${driver.rejected ? "line-through opacity-60" : ""}`}
            >
              {driver.label}
            </h4>
            <div className="flex items-center gap-2">
              <ConfidenceBadge confidence={driver.rejected ? "REJECTED" : driver.confidence} />
              <span className="text-[13px] font-semibold text-foreground">
                {fmtUsd(Math.abs(driver.contributionUsd))}
              </span>
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-3">
            <div className="h-[10px] flex-1 bg-secondary">
              <div className={`h-full ${barColor}`} style={{ width: driver.rejected ? "0%" : `${width}%` }} />
            </div>
            <span className="w-12 text-right font-mono text-[11.5px] text-muted-foreground">
              {driver.rejected ? "0%" : `${Math.abs(driver.contributionPct)}%`}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11.5px] italic text-muted-foreground">
              {driver.methodFamily}: {driver.method}
            </p>
            <div className="flex items-center gap-3">
              <MethodBadge type={driver.methodType} />
              <button onClick={() => setOpen(!open)} className="text-[11.5px] font-semibold text-primary">
                {open ? "Hide working" : "Show working"}
              </button>
            </div>
          </div>

          {driver.rejected && driver.rejectionReason && (
            <p className="mt-3 border-l-2 border-l-border bg-secondary/60 p-3 text-[12.5px] leading-relaxed text-foreground">
              Rejected: {driver.rejectionReason}
            </p>
          )}

          {driver.priorNote && (
            <p className="mt-2 text-[11.5px] text-pos">{driver.priorNote}</p>
          )}

          {open && (
            <div className="mt-3 space-y-3 bg-secondary/50 p-3">
              <div>
                <p className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">Estimated effect</p>
                <p className="mt-1 font-mono text-[12px] text-foreground">
                  {driver.effect.estimate} (95% interval {driver.effect.ciLow} to {driver.effect.ciHigh}), p ={" "}
                  {driver.effect.pValue}
                </p>
                <p className="text-[11px] text-muted-foreground">{driver.effect.unit}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Confidence score {driver.confidenceScore} on a zero to one scale.
                </p>
              </div>
              <div>
                <p className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">Refutation tests</p>
                <ul className="mt-1 space-y-1">
                  {driver.refutations.map((r) => (
                    <li key={r.name} className="text-[12px] leading-snug text-foreground">
                      <span className={r.passed ? "text-pos" : "text-neg"}>{r.passed ? "Passed" : "Failed"}</span>{" "}
                      · <span className="font-semibold">{r.name}:</span> {r.detail}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">Supporting evidence</p>
                <div className="mt-1">
                  <EvidenceList items={driver.evidence} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TracePanel({ brief }: { brief: BriefResult }) {
  const [open, setOpen] = useState(false);
  const nonLlm = brief.steps.filter((s) => s.type === "NON-LLM").length;
  return (
    <div className="mt-3">
      <button onClick={() => setOpen(!open)} className="text-[12px] text-primary underline underline-offset-2">
        {open ? "Hide execution trace" : "How was this produced?"}
      </button>
      {open && (
        <div className="mt-3 border border-border bg-secondary/40 p-4">
          <ol className="space-y-2">
            {brief.steps.map((s, i) => (
              <li key={s.step} className="border border-border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12.5px] font-semibold text-foreground">
                    {i + 1}. {s.step}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="border border-border px-1.5 py-[1px] text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      {s.capability}
                    </span>
                    <MethodBadge type={s.type} />
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {s.skipped ? "not called" : `${s.durationMs} ms`}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-[11.5px] text-muted-foreground">{s.method}</p>
                <p className="mt-1 text-[12px] text-foreground">{s.result}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[12px] leading-relaxed text-foreground">
            {nonLlm} of {brief.steps.length} steps are deterministic and reproducible. Every number in this brief
            comes from those steps. The language model, where it runs at all, receives a bounded payload of computed
            values and returns prose only.
          </p>
        </div>
      )}
    </div>
  );
}

function NarrativePanel({
  brief,
  narration,
  narrating,
}: {
  brief: BriefResult;
  narration: NarrationResult | null;
  narrating: boolean;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const usingModel = !!narration?.text;
  const body = narration?.text ?? brief.narrative.text;

  return (
    <section className="mt-6 border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">Executive narrative</p>
        <span className="border border-border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {narrating
            ? "generating"
            : usingModel
              ? narration?.source === "LLM_CACHED"
                ? "model, cached"
                : "model, guard passed"
              : "deterministic summary"}
        </span>
      </div>
      <p className="mt-3 font-serif text-[16px] leading-relaxed text-foreground">{body}</p>
      <p className="mt-3 text-[11.5px] leading-snug text-muted-foreground">
        {narrating
          ? "The deterministic summary is shown while narration runs. The figures will not change."
          : (narration?.guardVerdict ?? brief.narrative.guard)}
      </p>
      {narration && (
        <div className="mt-2">
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="text-[11.5px] text-primary underline underline-offset-2"
          >
            {showPrompt ? "Hide the payload sent to the model" : "Inspect the payload sent to the model"}
          </button>
          {showPrompt && (
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap border border-border bg-secondary/60 p-3 text-[11px] leading-snug text-foreground">
              {narration.promptPreview}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}

function FeedbackSection({ brief, onRecorded }: { brief: BriefResult; onRecorded: () => void }) {
  const [state, setState] = useState<"idle" | "issue" | "done" | "yes">("idle");
  const [text, setText] = useState("");
  const [driverId, setDriverId] = useState<string>(
    brief.kind === "BRIEF" ? (brief.drivers.find((d) => !d.rejected)?.id ?? "") : "",
  );

  const drivers = brief.kind === "BRIEF" ? brief.drivers : [];

  return (
    <section className="mt-10 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-foreground">Was this analysis correct?</p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            Verdicts are stored and replayed as priors on the next run, which changes the confidence attached to the
            driver you judge.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              recordFeedback({
                kpiId: brief.kpiId,
                driverId: driverId || null,
                persona: brief.persona,
                author: brief.personaLabel,
                verdict: "CONFIRMED",
                comment: "",
              });
              setState("yes");
              onRecorded();
            }}
            className="border border-pos px-3 py-1.5 text-[12px] font-semibold text-pos hover:bg-pos/5"
          >
            Confirm
          </button>
          <button
            onClick={() => setState("issue")}
            className="border border-neg px-3 py-1.5 text-[12px] font-semibold text-neg hover:bg-neg/5"
          >
            Flag a correction
          </button>
        </div>
      </div>

      {brief.feedbackCount > 0 && (
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          {brief.feedbackCount} prior verdict{brief.feedbackCount === 1 ? "" : "s"} already applied to this KPI.
        </p>
      )}

      {state === "issue" && (
        <div className="mt-4">
          {drivers.length > 0 && (
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="mb-2 w-full border border-input bg-background p-2 text-[13px] outline-none focus:border-primary"
            >
              <option value="">Applies to the whole brief</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe what is wrong and what the correct attribution should be."
            rows={3}
            className="w-full border border-input bg-background p-3 text-[13px] outline-none focus:border-primary"
          />
          <button
            onClick={() => {
              recordFeedback({
                kpiId: brief.kpiId,
                driverId: driverId || null,
                persona: brief.persona,
                author: brief.personaLabel,
                verdict: text.trim() ? "CORRECTED" : "REJECTED",
                comment: text.trim(),
              });
              setState("done");
              onRecorded();
            }}
            className="mt-2 bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground"
          >
            Submit correction
          </button>
        </div>
      )}

      {(state === "done" || state === "yes") && (
        <div className="mt-4 border-l-4 border-l-pos bg-pos/5 px-4 py-3 text-[12.5px] text-foreground">
          Recorded and applied. Regenerate this brief to see the adjusted confidence and the correction listed in the
          applied priors.
        </div>
      )}
    </section>
  );
}

function SourcePanel({ brief }: { brief: BriefResult }) {
  return (
    <div className="mt-4 overflow-x-auto border border-border">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-secondary text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
            <th className="px-3 py-2 font-semibold">Source system</th>
            <th className="px-3 py-2 font-semibold">Grain</th>
            <th className="px-3 py-2 font-semibold">Cadence</th>
            <th className="px-3 py-2 font-semibold">Rows</th>
            <th className="px-3 py-2 font-semibold">Freshness</th>
            <th className="px-3 py-2 font-semibold">Quality</th>
          </tr>
        </thead>
        <tbody>
          {brief.sources.map((s) => (
            <tr key={s.dataset} className="border-t border-border align-top">
              <td className="px-3 py-2 font-medium text-foreground">
                {s.system}
                <span className="block text-[11px] text-muted-foreground">{s.dataset}</span>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{s.grain}</td>
              <td className="px-3 py-2 text-muted-foreground">{s.cadence}</td>
              <td className="px-3 py-2 font-mono">{s.rows.toLocaleString()}</td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <FreshnessDot status={s.status} />
                  {s.ageHours} h old, SLA {s.slaHours} h
                </span>
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {s.qualityScore} · {s.qualityNotes}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DecisionBrief({
  brief,
  narration,
  narrating,
  onBack,
  onRefresh,
  onClarify,
}: {
  brief: BriefResult;
  narration: NarrationResult | null;
  narrating: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onClarify: (optionId: string) => void;
}) {
  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <button onClick={onBack} className="text-[12px] text-muted-foreground hover:text-primary">
        Back to dashboard
      </button>
      <p className="mt-3 text-[11.5px] uppercase tracking-[0.1em] text-muted-foreground">
        Dashboard / {brief.kpiName} / {brief.kind === "BRIEF" ? "Decision brief" : "Abstention"}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-[28px] font-bold leading-tight tracking-tight text-foreground">
          {brief.kpiName}
        </h1>
        <SignalBadge signal={brief.snapshot.signal} />
      </div>
      <p className="mt-1.5 text-[12px] text-muted-foreground">
        Generated {brief.generatedAt} for {brief.personaLabel}. Deterministic compute {brief.telemetry.computeMs} ms
        over {brief.telemetry.rowsScanned.toLocaleString()} rows.{" "}
        {narration && narration.costUsd > 0
          ? `Narration ${narration.model}, ${narration.inputTokens + narration.outputTokens} tokens, $${narration.costUsd.toFixed(4)}.`
          : "No model spend on this brief."}
      </p>
      {brief.access.rowFilter && (
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Entitlement applied: {brief.access.rule}
        </p>
      )}

      <TracePanel brief={brief} />
      <NarrativePanel brief={brief} narration={narration} narrating={narrating} />

      {brief.appliedCorrections.length > 0 && (
        <div className="mt-4 border-l-4 border-l-pos bg-pos/5 px-4 py-2.5">
          <p className="text-[12.5px] font-semibold text-foreground">Analyst corrections applied to this run</p>
          <ul className="mt-1 space-y-1">
            {brief.appliedCorrections.map((c) => (
              <li key={c} className="text-[12px] text-foreground">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {brief.kind === "BRIEF" ? (
        <StandardBody brief={brief} />
      ) : (
        <AbstentionBody brief={brief} onClarify={onClarify} />
      )}

      <section className="mt-9">
        <SectionHeading index="05" title="Data lineage and reconciliation" />
        <SourcePanel brief={brief} />
        <ul className="mt-3 space-y-2">
          {brief.reconciliation.map((r) => (
            <li key={r.issue} className="border-l-2 border-l-border pl-3 text-[12.5px] leading-relaxed text-foreground">
              <span className="font-semibold">{r.issue}</span> {r.resolution}
              <span className="block text-[11px] italic text-muted-foreground">Method: {r.method}</span>
            </li>
          ))}
        </ul>
      </section>

      <FeedbackSection brief={brief} onRecorded={onRefresh} />
    </div>
  );
}

function StandardBody({ brief }: { brief: DecisionBriefResult }) {
  return (
    <>
      <section className="mt-9">
        <SectionHeading index="01" title="What changed" />
        <p className="text-[13.5px] leading-relaxed text-foreground">{brief.whatChanged.summary}</p>
        <div className="mt-4 overflow-x-auto border border-border">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-secondary text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Metric</th>
                <th className="px-3 py-2 font-semibold">Period</th>
                <th className="px-3 py-2 font-semibold">Value</th>
                <th className="px-3 py-2 font-semibold">Change</th>
                <th className="px-3 py-2 font-semibold">z score</th>
                <th className="px-3 py-2 font-semibold">Materiality</th>
              </tr>
            </thead>
            <tbody>
              {brief.whatChanged.table.map((r, i) => (
                <tr key={`${r.metric}-${i}`} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-foreground">{r.metric}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.period}</td>
                  <td className="px-3 py-2 font-mono">{r.value}</td>
                  <td className="px-3 py-2 font-mono">{r.vsBaseline}</td>
                  <td className="px-3 py-2 font-mono">{r.zScore}</td>
                  <td className={`px-3 py-2 ${materialityClass(r.materiality)}`}>{r.materiality}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11.5px] text-muted-foreground">{brief.snapshot.materialityReason}</p>
      </section>

      {brief.drivers.length > 0 && (
        <section className="mt-9">
          <SectionHeading index="02" title="Why it changed" />
          <p className="text-[13.5px] leading-relaxed text-foreground">
            Hypotheses are generated from the driver register in the KPI contract, estimated on the daily panel, and
            then attacked with refutation tests. Anything that fails is shown here as rejected rather than removed.{" "}
            {brief.unexplainedPct} percent of the movement remains unattributed.
          </p>
          <div className="mt-4 space-y-3">
            {brief.drivers.map((d, i) => (
              <DriverCard key={d.id} driver={d} rank={i + 1} />
            ))}
          </div>
        </section>
      )}

      {brief.actions.length > 0 && (
        <section className="mt-9">
          <SectionHeading index="03" title="What to do" />
          {brief.restrictedNotice && (
            <div className="mb-4 border-l-4 border-l-signal-watch bg-warn px-4 py-2.5 text-[12.5px] text-warn-foreground">
              {brief.restrictedNotice}
            </div>
          )}
          <div className="space-y-3">
            {brief.actions.map((a) => (
              <div key={a.rank} className="border border-border bg-card p-4">
                <div className="flex gap-4">
                  <span className="font-serif text-[22px] font-bold leading-none text-muted-foreground/50">
                    {String(a.rank).padStart(2, "0")}
                  </span>
                  <div className="flex-1">
                    <h4 className="text-[14.5px] font-semibold leading-snug text-foreground">{a.action}</h4>
                    <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-2">
                      <div>
                        <dt className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">Lever</dt>
                        <dd className="text-foreground">{a.lever}</dd>
                      </div>
                      <div>
                        <dt className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">Owner</dt>
                        <dd className="font-semibold text-foreground">{a.owner}</dd>
                      </div>
                      <div>
                        <dt className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
                          Expected impact
                        </dt>
                        <dd className="text-foreground">{a.expectedImpact}</dd>
                      </div>
                      <div>
                        <dt className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">Due</dt>
                        <dd className="font-semibold text-foreground">{a.deadline}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 bg-secondary/60 p-3 text-[12px] leading-relaxed text-foreground">
                      <p>
                        <span className="font-semibold">Monitoring: </span>
                        {a.monitoring.metric} from {a.monitoring.source}, reviewed {a.monitoring.frequency.toLowerCase()}
                        . Success is {a.monitoring.threshold.toLowerCase()}. First review {a.monitoring.firstReview},
                        owned by {a.monitoring.owner}.
                      </p>
                      <p className="mt-1 text-muted-foreground">Constraint: {a.constraint}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11.5px] italic text-muted-foreground">
                        Decision rights: {a.decisionRights}
                      </p>
                      <ConfidenceBadge confidence={a.confidence} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-9">
        <SectionHeading index="04" title="What we do not know" />
        <div className="border-l-4 border-l-signal-watch bg-card py-1 pl-4">
          <p className="text-[13.5px] leading-relaxed text-foreground">{brief.uncertainty.statement}</p>
          <div className="mt-3 bg-secondary p-4">
            <p className="text-[12.5px] leading-relaxed text-foreground">
              <span className="font-semibold">To resolve: </span>
              {brief.uncertainty.resolution}
            </p>
            <p className="mt-2 text-[11.5px] text-muted-foreground">
              Owner: {brief.uncertainty.owner} · Due: {brief.uncertainty.deadline}
            </p>
            <p className="mt-2 text-[12px] italic text-foreground">{brief.uncertainty.confidenceImpact}</p>
          </div>
        </div>
      </section>
    </>
  );
}

function AbstentionBody({
  brief,
  onClarify,
}: {
  brief: AbstentionResult;
  onClarify: (optionId: string) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <>
      <div className="mt-6 border-l-4 border-l-signal-sparse bg-secondary px-4 py-3">
        <p className="text-[13.5px] font-semibold text-foreground">{brief.banner}</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-foreground">{brief.reason}</p>
        <p className="mt-2 font-mono text-[11.5px] text-muted-foreground">Rule fired: {brief.rule}</p>
      </div>

      <section className="mt-9">
        <SectionHeading index="01" title="What is observed" />
        <p className="text-[13.5px] leading-relaxed text-foreground">{brief.observation}</p>
      </section>

      <section className="mt-9">
        <SectionHeading index="02" title="Hypotheses considered and set aside" />
        <div className="overflow-x-auto border border-border">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-secondary text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Hypothesis</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody>
              {brief.hypothesesConsidered.map((h) => (
                <tr key={h.hypothesis} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium text-foreground">{h.hypothesis}</td>
                  <td className="px-3 py-2 text-muted-foreground">{h.status}</td>
                  <td className="px-3 py-2 text-foreground">{h.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {brief.clarificationQuestion && (
        <section className="mt-9">
          <SectionHeading index="03" title="One question before proceeding" />
          <p className="text-[13.5px] font-semibold leading-relaxed text-foreground">
            {brief.clarificationQuestion}
          </p>
          <div className="mt-3 space-y-2">
            {brief.clarificationOptions?.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  setChosen(o.id);
                  onClarify(o.id);
                }}
                className={`block w-full border p-3 text-left transition-colors ${
                  chosen === o.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary"
                }`}
              >
                <span className="block text-[13px] font-semibold text-foreground">{o.label}</span>
                <span className="mt-1 block text-[12px] leading-snug text-muted-foreground">{o.consequence}</span>
              </button>
            ))}
          </div>
          {chosen && (
            <p className="mt-3 border-l-4 border-l-pos bg-pos/5 px-4 py-2.5 text-[12.5px] text-foreground">
              Answer recorded and routed to {brief.resolution.owner}. The engine will rerun with the answer as a
              declared assumption. No cause has been asserted in the meantime.
            </p>
          )}
        </section>
      )}

      <section className="mt-9">
        <SectionHeading index="04" title="How this resolves" />
        <div className="bg-secondary p-4 text-[12.5px] leading-relaxed text-foreground">
          <p>{brief.resolution.action}</p>
          {brief.resolution.interim && <p className="mt-2">Interim option: {brief.resolution.interim}</p>}
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            Owner: {brief.resolution.owner} · Timeline: {brief.resolution.timeline}
          </p>
        </div>
        {brief.evidence.length > 0 && (
          <div className="mt-4 border border-border bg-card p-3">
            <p className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">Retrieved context</p>
            <div className="mt-2">
              <EvidenceList items={brief.evidence} />
            </div>
          </div>
        )}
      </section>
    </>
  );
}
