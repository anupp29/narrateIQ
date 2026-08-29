import { useState } from "react";
import type { AbstentionBrief, Brief, Evidence, Hypothesis } from "@/data/narrateiq";
import { ConfidenceBadge, FreshnessDot, MethodBadge, SectionHeading } from "./primitives";

function materialityClass(m: string) {
  if (m === "HIGH") return "text-signal-anomaly font-semibold";
  if (m === "MEDIUM") return "text-warn-foreground font-semibold";
  return "text-muted-foreground";
}

function deadlineClass(d: string) {
  const s = d.toLowerCase();
  if (s.includes("immediate") || s.includes("48") || s === "today") return "text-signal-anomaly";
  if (s.includes("72")) return "text-warn-foreground";
  return "text-muted-foreground";
}

function EvidenceIcon({ type }: { type: Evidence["type"] }) {
  const common = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 };
  if (type === "SQL")
    return (
      <svg {...common}>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
      </svg>
    );
  if (type === "Tickets")
    return (
      <svg {...common}>
        <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </svg>
  );
}

function HypothesisCard({ h }: { h: Hypothesis }) {
  const [open, setOpen] = useState(false);
  const barColor = h.rejected
    ? "bg-muted"
    : h.confidence === "HIGH"
      ? "bg-pos"
      : "bg-signal-watch";

  return (
    <div className="border border-border bg-card p-4">
      <div className="flex gap-4">
        <span className="font-serif text-[22px] font-bold leading-none text-muted-foreground/50">
          {String(h.rank).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4
              className={`text-[14.5px] font-semibold text-foreground ${h.rejected ? "line-through opacity-60" : ""}`}
            >
              {h.driver}
            </h4>
            <div className="flex items-center gap-2">
              <ConfidenceBadge confidence={h.confidence} />
              <span className="text-[13px] font-semibold text-foreground">{h.contributionAbs}</span>
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-3">
            <div className="h-[10px] flex-1 bg-secondary">
              <div
                className={`h-full ${barColor}`}
                style={{ width: h.rejected ? "0%" : `${h.contributionPct}%` }}
              />
            </div>
            <span className="w-10 text-right font-mono text-[11.5px] text-muted-foreground">
              {h.rejected ? "0%" : `${h.contributionPct}%`}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11.5px] italic text-muted-foreground">Method: {h.method}</p>
            <div className="flex items-center gap-3">
              <MethodBadge type={h.type} />
              <button
                onClick={() => setOpen(!open)}
                className="text-[11.5px] font-semibold text-primary"
              >
                {h.rejected ? "Why rejected" : "Evidence"} {open ? "↑" : "↓"}
              </button>
            </div>
          </div>

          {open && h.rejected && (
            <p className="mt-3 border-l-2 border-l-border bg-secondary/60 p-3 text-[12.5px] leading-relaxed text-foreground">
              {h.rejectionReason}
            </p>
          )}

          {open && !h.rejected && (
            <div className="mt-3 space-y-2 bg-secondary/50 p-3">
              {h.evidence?.map((e, i) => (
                <div key={i} className="flex gap-2.5 border-b border-border pb-2 last:border-0 last:pb-0">
                  <span className="mt-[3px] text-muted-foreground">
                    <EvidenceIcon type={e.type} />
                  </span>
                  <div>
                    <p className="text-[12.5px] leading-relaxed text-foreground">
                      <span className="font-semibold">{e.label}: </span>
                      {e.text}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Source: {e.source} · Relevance: {e.relevanceScore}
                    </p>
                  </div>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-muted-foreground">
                Retrieved via: TF-IDF similarity on CRM notes + tickets · NON-LLM
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProvenancePanel({ brief }: { brief: Brief | AbstentionBrief }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button onClick={() => setOpen(!open)} className="text-[12px] text-primary underline underline-offset-2">
        How was this generated? {open ? "↑" : "↓"}
      </button>
      {open && (
        <div className="mt-3 border border-border bg-secondary/40 p-4">
          <div className="flex flex-wrap items-stretch gap-2">
            {brief.processingSteps.map((s, i) => (
              <div key={s.step} className="flex items-stretch gap-2">
                <div className="min-w-[150px] flex-1 border border-border bg-card p-2.5">
                  <p className="text-[11.5px] font-semibold leading-tight text-foreground">{s.step}</p>
                  <p className="mt-1 text-[10.5px] leading-tight text-muted-foreground">{s.method}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <MethodBadge type={s.type} />
                    <span className="font-mono text-[10.5px] text-muted-foreground">{s.duration}</span>
                  </div>
                </div>
                {i < brief.processingSteps.length - 1 && (
                  <span className="self-center text-muted-foreground">→</span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-foreground">
            4 of 5 steps used deterministic, auditable, non-LLM logic. The language model received a
            structured data payload and generated natural language only. It performed no quantitative
            reasoning.
          </p>
          <button onClick={() => setOpen(false)} className="mt-2 text-[11.5px] text-primary underline">
            Collapse
          </button>
        </div>
      )}
    </div>
  );
}

function FeedbackSection({ count }: { count: number }) {
  const [state, setState] = useState<"idle" | "issue" | "done" | "yes">("idle");
  const [text, setText] = useState("");

  return (
    <section className="mt-10 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] font-semibold text-foreground">Was this brief accurate?</p>
        <div className="flex gap-2">
          <button
            onClick={() => setState("yes")}
            className="border border-pos px-3 py-1.5 text-[12px] font-semibold text-pos hover:bg-pos/5"
          >
            Yes — correct ✓
          </button>
          <button
            onClick={() => setState("issue")}
            className="border border-neg px-3 py-1.5 text-[12px] font-semibold text-neg hover:bg-neg/5"
          >
            No — flag an issue
          </button>
        </div>
      </div>

      {count > 0 && (
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          This brief was already informed by {count} past analyst corrections.
        </p>
      )}

      {state === "issue" && (
        <div className="mt-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe the issue or correction"
            rows={3}
            className="w-full border border-input bg-background p-3 text-[13px] outline-none focus:border-primary"
          />
          <button
            onClick={() => setState("done")}
            className="mt-2 bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground"
          >
            Submit correction
          </button>
        </div>
      )}

      {(state === "done" || state === "yes") && (
        <div className="mt-4 border-l-4 border-l-pos bg-pos/5 px-4 py-3 text-[12.5px] text-foreground">
          {state === "yes"
            ? "Confirmation recorded. This brief has been marked accurate and will reinforce similar future classifications."
            : "Correction recorded. NarrateIQ will apply this to similar future anomalies in the South region."}
        </div>
      )}
    </section>
  );
}

export function DecisionBrief({
  brief,
  onBack,
}: {
  brief: Brief | AbstentionBrief;
  onBack: () => void;
}) {
  const [flagged, setFlagged] = useState<string | null>(null);
  const [feedbackInfo, setFeedbackInfo] = useState(false);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      <button onClick={onBack} className="text-[12px] text-muted-foreground hover:text-primary">
        ← Dashboard
      </button>
      <p className="mt-3 text-[11.5px] uppercase tracking-[0.1em] text-muted-foreground">
        Dashboard → {brief.kpiName} → Decision Brief
      </p>
      <h1 className="mt-1.5 font-serif text-[28px] font-bold leading-tight tracking-tight text-foreground">
        {brief.kpiName}
      </h1>
      <p className="mt-1.5 text-[12px] text-muted-foreground">
        Generated {brief.generatedAt} · Persona: {brief.persona} · {brief.totalLatency} ·{" "}
        {brief.abstain
          ? "LLM cost: $0.000 — abstention triggered before narrative generation"
          : `Est. cost: ${brief.estimatedCost} · Tokens: ${brief.tokenCount}`}
      </p>

      <ProvenancePanel brief={brief} />

      {brief.feedbackCount > 0 && (
        <div className="mt-4 border-l-4 border-l-pos bg-pos/5 px-4 py-2.5">
          <p className="text-[12.5px] text-foreground">
            This brief was informed by {brief.feedbackCount} analyst corrections from similar past
            anomalies.
            <button
              onClick={() => setFeedbackInfo(!feedbackInfo)}
              className="ml-2 text-primary underline underline-offset-2"
            >
              ⓘ
            </button>
          </p>
          {feedbackInfo && (
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">
              Most recent correction applied: "Billing migration effects should be attributed to the
              week of invoice issue, not the week of order." — Analytics Lead, 11 days ago.
            </p>
          )}
        </div>
      )}

      {brief.abstain ? (
        <AbstentionBody brief={brief} flagged={flagged} setFlagged={setFlagged} />
      ) : (
        <StandardBody brief={brief} />
      )}

      <FeedbackSection count={brief.feedbackCount} />
    </div>
  );
}

function StandardBody({ brief }: { brief: Brief }) {
  const restricted = brief.restrictedActionsNotice;
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
                <th className="px-3 py-2 font-semibold">vs Baseline</th>
                <th className="px-3 py-2 font-semibold">Z-Score</th>
                <th className="px-3 py-2 font-semibold">Materiality</th>
              </tr>
            </thead>
            <tbody>
              {brief.whatChanged.table.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-foreground">{r.metric}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.period}</td>
                  <td className="px-3 py-2 font-mono">{r.value}</td>
                  <td className="px-3 py-2 font-mono text-neg">{r.vsBaseline}</td>
                  <td className="px-3 py-2 font-mono">{r.zScore}</td>
                  <td className={`px-3 py-2 ${materialityClass(r.materiality)}`}>{r.materiality}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {brief.whatChanged.sources.map((s) => (
            <span
              key={s.name}
              className="inline-flex items-center gap-1.5 border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground"
            >
              <FreshnessDot status={s.status} />
              {s.name} · {s.cadence} · {s.freshness}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-9">
        <SectionHeading index="02" title="Why it changed" />
        <p className="text-[13.5px] leading-relaxed text-foreground">{brief.whyItChanged.summary}</p>
        <div className="mt-4 space-y-3">
          {brief.whyItChanged.hypotheses.map((h) => (
            <HypothesisCard key={h.rank} h={h} />
          ))}
        </div>
      </section>

      <section className="mt-9">
        <SectionHeading index="03" title="What to do" />
        {restricted && (
          <div className="mb-4 border-l-4 border-l-signal-watch bg-warn px-4 py-2.5 text-[12.5px] text-warn-foreground">
            {restricted}
          </div>
        )}
        <div className="space-y-3">
          {brief.whatToDo.map((a) => (
            <div key={a.rank} className="border border-border bg-card p-4">
              <div className="flex gap-4">
                <span className="font-serif text-[22px] font-bold leading-none text-muted-foreground/50">
                  {String(a.rank).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <h4 className="text-[14.5px] font-semibold leading-snug text-foreground">
                    {a.action}
                  </h4>
                  <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-2">
                    <div>
                      <dt className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
                        Business lever
                      </dt>
                      <dd className="text-foreground">{a.lever}</dd>
                    </div>
                    <div>
                      <dt className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
                        Owner
                      </dt>
                      <dd className="font-semibold text-foreground">{a.owner}</dd>
                    </div>
                    <div>
                      <dt className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
                        Expected impact
                      </dt>
                      <dd className="text-foreground">{a.expectedImpact}</dd>
                    </div>
                    <div>
                      <dt className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
                        Deadline
                      </dt>
                      <dd className={`font-semibold ${deadlineClass(a.deadline)}`}>{a.deadline}</dd>
                    </div>
                  </dl>
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

      <section className="mt-9">
        <SectionHeading index="04" title="What we don't know" />
        <div className="border-l-4 border-l-signal-watch bg-card py-1 pl-4">
          <p className="text-[13.5px] leading-relaxed text-foreground">
            {brief.whatWeDontKnow.uncertainty}
          </p>
          <div className="mt-3 bg-secondary p-4">
            {brief.whatWeDontKnow.resolutionAction && (
              <p className="text-[12.5px] leading-relaxed text-foreground">
                <span className="font-semibold">To resolve this: </span>
                {brief.whatWeDontKnow.resolutionAction}
              </p>
            )}
            <p className="mt-2 text-[11.5px] text-muted-foreground">
              Owner: {brief.whatWeDontKnow.resolutionOwner} · Timeline:{" "}
              {brief.whatWeDontKnow.resolutionDeadline}
            </p>
            {brief.whatWeDontKnow.confidenceImpact && (
              <p className="mt-2 text-[12px] italic text-foreground">
                Resolving this would: {brief.whatWeDontKnow.confidenceImpact}
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function AbstentionBody({
  brief,
  flagged,
  setFlagged,
}: {
  brief: AbstentionBrief;
  flagged: string | null;
  setFlagged: (v: string) => void;
}) {
  return (
    <>
      <div className="mt-6 flex items-start gap-3 border-l-4 border-l-signal-watch bg-warn px-5 py-4">
        <span className="mt-[2px] text-warn-foreground">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
        </span>
        <div>
          <p className="text-[14.5px] font-semibold text-warn-foreground">{brief.abstentionBanner}</p>
          <p className="mt-1 text-[12px] uppercase tracking-[0.08em] text-warn-foreground/80">
            Reason:{" "}
            {brief.abstentionType === "SPARSE_HISTORY"
              ? "Insufficient history to establish a statistical baseline"
              : "Evidence from independent sources contradicts itself"}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-foreground">{brief.abstentionReason}</p>
        </div>
      </div>

      <section className="mt-9">
        <SectionHeading index="01" title="What we observe" />
        <p className="text-[13.5px] leading-relaxed text-foreground">{brief.whatWeObserve}</p>
      </section>

      {brief.hypothesesConsidered.length > 0 && (
        <section className="mt-9">
          <SectionHeading index="02" title="Hypotheses considered" />
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
                {brief.hypothesesConsidered.map((h, i) => (
                  <tr key={i} className={`border-t border-border ${i % 2 ? "bg-secondary/40" : ""}`}>
                    <td className="px-3 py-2 font-medium text-foreground">{h.hypothesis}</td>
                    <td
                      className={`px-3 py-2 font-semibold ${
                        h.status === "REJECTED" ? "text-signal-anomaly" : "text-warn-foreground"
                      }`}
                    >
                      {h.status}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{h.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-9">
        <SectionHeading
          index={brief.hypothesesConsidered.length > 0 ? "03" : "02"}
          title="Resolution path"
        />
        <div className="border-l-4 border-l-signal-watch bg-secondary p-4">
          <p className="text-[12.5px] leading-relaxed text-foreground">
            <span className="font-semibold">To resolve this: </span>
            {brief.resolutionPath.action}
          </p>
          {brief.resolutionPath.interimAction && (
            <p className="mt-2 text-[12.5px] leading-relaxed text-foreground">
              <span className="font-semibold">Interim rule: </span>
              {brief.resolutionPath.interimAction}
            </p>
          )}
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            Owner: {brief.resolutionPath.owner} · Timeline: {brief.resolutionPath.timeline}
          </p>
        </div>
        <p className="mt-3 text-[11.5px] text-muted-foreground">{brief.note}</p>

        {flagged ? (
          <div className="mt-4 border-l-4 border-l-pos bg-pos/5 px-4 py-3 text-[12.5px] text-foreground">
            Review request sent to Analytics Lead. Reference: {flagged}
          </div>
        ) : (
          <button
            onClick={() => setFlagged(`NIQ-${Date.now().toString().slice(-8)}`)}
            className="mt-4 w-full bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Flag for analyst review
          </button>
        )}
      </section>
    </>
  );
}
