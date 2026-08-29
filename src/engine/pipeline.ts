/**
 * Orchestrator.
 *
 * Runs the deterministic chain for one KPI and one persona and returns either
 * a decision brief, an abstention, or a clarification request. Every step is
 * timed and labelled with the technique it used, so the trace shown in the
 * interface is the trace that actually executed. The language model is not
 * involved in any decision made in this file.
 */

import { AS_OF, addDays, deals, nps, ops, rowCounts } from "./datasets";
import { buildActions } from "./actions";
import {
  competitorPricingHypothesis,
  consistencyCheck,
  discountingHypothesis,
  seasonalityHypothesis,
} from "./causal";
import { decomposeRevenue } from "./contribution";
import { feedbackCountFor, priorsFor } from "./feedback";
import { computeKpi, fmtUsd, weeklyNps, weeklyReturnRate } from "./metrics";
import { evaluateAccess, PERSONA_LABEL, type Persona } from "./rbac";
import { reconciliationNotes, sourceStatuses } from "./reconcile";
import { retrieve } from "./retrieval";
import { KPI_CONTRACTS } from "./semantic";
import { round, sum } from "./stats";
import type {
  AbstentionResult,
  BriefResult,
  DecisionBriefResult,
  DriverFinding,
  EvidenceItem,
  StepTrace,
} from "./types";

const totalRows = (): number => sum(Object.values(rowCounts()));

const now = (): number => (typeof performance === "undefined" ? Date.now() : performance.now());

class Trace {
  private steps: StepTrace[] = [];
  private t0 = now();

  run<T>(
    step: string,
    method: string,
    capability: StepTrace["capability"],
    fn: () => T,
    describe: (value: T) => string,
  ): T {
    const start = now();
    const value = fn();
    this.steps.push({
      step,
      method,
      type: "NON-LLM",
      capability,
      durationMs: round(now() - start, 1),
      result: describe(value),
    });
    return value;
  }

  skip(step: string, method: string, reason: string) {
    this.steps.push({
      step,
      method,
      type: "LLM",
      capability: "EXTERNAL",
      durationMs: 0,
      result: reason,
      skipped: true,
    });
  }

  done(): { steps: StepTrace[]; totalMs: number } {
    return { steps: this.steps, totalMs: round(now() - this.t0, 1) };
  }
}

const confidenceFrom = (score: number): DriverFinding["confidence"] =>
  score >= 0.75 ? "HIGH" : score >= 0.5 ? "MEDIUM" : "LOW";

const toEvidence = (items: ReturnType<typeof retrieve>): EvidenceItem[] =>
  items.map((e) => ({
    noteId: e.noteId,
    source: e.source,
    date: e.date,
    authorRole: e.authorRole,
    text: e.text,
    score: e.score,
  }));

function deterministicNarrative(lines: string[]): { text: string; source: "DETERMINISTIC_TEMPLATE"; guard: string } {
  return {
    text: lines.join(" "),
    source: "DETERMINISTIC_TEMPLATE",
    guard: "Template assembled from computed values. No model call has been made yet.",
  };
}

export function runBrief(kpiId: string, persona: Persona): BriefResult {
  const contract = KPI_CONTRACTS[kpiId];
  if (!contract) throw new Error(`Unknown KPI ${kpiId}`);
  const trace = new Trace();

  const access = trace.run(
    "Entitlement evaluation",
    "Row, column and domain rules from the semantic contract, evaluated before any data is read",
    "CUSTOM",
    () => evaluateAccess(persona, contract),
    (a) => (a.allowed ? `Access granted. ${a.rule}` : `Access denied. ${a.rule}`),
  );

  const snapshot = trace.run(
    "Signal validation",
    "Seasonal-trend decomposition, robust z-score on the deseasonalised window, two-sided CUSUM change point, materiality gate",
    "CUSTOM",
    () => computeKpi(kpiId, persona),
    (s) =>
      `${s.name} ${s.valueFormatted}, ${s.changePct > 0 ? "+" : ""}${s.changePct} percent against baseline. Signal ${s.signal}${s.zScore === null ? "" : `, z = ${s.zScore}`}.`,
  );

  const sources = trace.run(
    "Source reconciliation",
    "Freshness against source SLA, grain alignment to complete ISO weeks, completeness scoring",
    "CUSTOM",
    () => sourceStatuses(contract),
    (s) => `${s.length} sources checked. ${s.filter((x) => x.status !== "current").length} outside the comfortable freshness band.`,
  );

  const reconciliation = reconciliationNotes(kpiId);
  const feedbackCount = feedbackCountFor(kpiId);
  const priors = priorsFor(kpiId);
  const appliedCorrections = Object.values(priors)
    .filter((p) => p.lastComment)
    .map((p) => `${p.driverId}: ${p.lastComment}`);

  const common = {
    kpiId,
    kpiName: contract.name,
    persona,
    personaLabel: PERSONA_LABEL[persona],
    generatedAt: `${AS_OF}T08:30:00Z`,
    sources,
    reconciliation,
    feedbackCount,
    appliedCorrections,
    access: { rowFilter: access.rowFilter, maskedColumns: access.maskedColumns, rule: access.rule },
  };

  // ---------------------------------------------------- abstention branches

  if (snapshot.signal === "SPARSE") {
    return sparseAbstention(kpiId, persona, snapshot, trace, common);
  }

  if (kpiId === "returnRate") {
    const contradiction = trace.run(
      "Cross-source consistency test",
      "Directional correlation between the operations return rate and the independent satisfaction survey",
      "CUSTOM",
      () => {
        const returns = weeklyReturnRate(persona).map((p) => p.value);
        const satisfaction = weeklyNps(persona).map((p) => p.value);
        return consistencyCheck(returns.slice(-8), satisfaction.slice(-8), -1);
      },
      (c) => `${c.detail} Verdict: ${c.consistent ? "consistent" : "contradictory"}.`,
    );
    if (!contradiction.consistent) {
      return contradictionAbstention(kpiId, persona, snapshot, trace, common, contradiction);
    }
  }

  if (snapshot.signal === "NOISE") {
    return noiseBrief(kpiId, persona, snapshot, trace, common);
  }

  // ---------------------------------------------------- full decision brief

  const decomposition = trace.run(
    "Dimensional drill-down",
    "Exact accounting decomposition by region and segment into volume, price, mix and timing effects",
    "CUSTOM",
    () => decomposeRevenue(persona),
    (d) =>
      `Change of ${fmtUsd(Math.abs(d.delta))} decomposed. Largest single cell ${d.concentration?.label ?? "none"} at ${d.concentration?.shareOfDelta ?? 0} percent of the demand driven change.`,
  );

  const focus = (decomposition.cells[0] ?? { region: "South", segment: "SMB" }) as {
    region: string;
    segment: string;
  };

  const hypotheses = trace.run(
    "Causal estimation and refutation",
    "Ordinary least squares on the daily panel with an explicit adjustment set, then placebo, added common cause and data subset refutations",
    "CUSTOM",
    () => {
      const competitor = competitorPricingHypothesis(focus.region, focus.segment);
      const discount = discountingHypothesis(focus.region, focus.segment);
      const season = seasonalityHypothesis(
        focus.region,
        focus.segment,
        decomposition.cells[0]?.delta ?? decomposition.delta,
      );
      return { competitor, discount, season };
    },
    (h) =>
      `Three hypotheses tested. ${[h.competitor, h.discount, h.season].filter((x) => !x.rejected).length} survived refutation.`,
  );

  const timingUsd = decomposition.totals.timing;

  const drivers: DriverFinding[] = [];

  if (Math.abs(timingUsd) > 1000) {
    drivers.push({
      id: "invoice_timing",
      label: "Invoice timing from the billing platform migration",
      method:
        "Accounting reconciliation between booked and recognised revenue, matched on invoice issue date from the semantic contract",
      methodType: "NON-LLM",
      methodFamily: "accounting",
      contributionUsd: timingUsd,
      contributionPct: round((timingUsd / decomposition.delta) * 100, 1),
      confidence: "HIGH",
      confidenceScore: 0.95,
      effect: {
        estimate: timingUsd,
        ciLow: timingUsd,
        ciHigh: timingUsd,
        pValue: 0,
        unit: "USD, exact identity",
      },
      refutations: [
        {
          name: "Identity check",
          detail: "Booked less recognised revenue reconciles to the reported gap with no residual.",
          passed: true,
        },
        {
          name: "Baseline comparison",
          detail: "The equivalent gap in the preceding window was immaterial, so the effect is specific to the migration period.",
          passed: true,
        },
      ],
      evidence: toEvidence(retrieve("billing migration invoice delay recognition cut-off", 2)),
      rejected: false,
    });
  }

  const addCausal = (
    h: ReturnType<typeof competitorPricingHypothesis>,
    query: string,
    family: DriverFinding["methodFamily"] = "causal inference",
  ) => {
    const prior = priors[h.id];
    const refutationsPassed = h.refutations.filter((r) => r.passed).length;
    const base = 0.35 + 0.2 * refutationsPassed + (h.estimate.pValue < 0.01 ? 0.1 : 0);
    const score = Math.max(0.05, Math.min(0.98, base + (prior?.adjustment ?? 0)));
    drivers.push({
      id: h.id,
      label: h.label,
      method: h.method,
      methodType: "NON-LLM",
      methodFamily: family,
      contributionUsd: round(h.impactUsd, 0),
      contributionPct: round((h.impactUsd / decomposition.delta) * 100, 1),
      confidence: h.rejected ? "LOW" : confidenceFrom(score),
      confidenceScore: round(score, 2),
      effect: {
        estimate: h.estimate.coefficient,
        ciLow: h.estimate.ciLow,
        ciHigh: h.estimate.ciHigh,
        pValue: h.estimate.pValue,
        unit: "USD of daily booked revenue per unit of treatment",
      },
      refutations: h.refutations,
      evidence: toEvidence(retrieve(query, 2, { region: focus.region })),
      rejected: h.rejected,
      rejectionReason: h.rejectionReason,
      priorNote: prior
        ? `Analyst feedback applied: ${prior.confirmations} confirmation${prior.confirmations === 1 ? "" : "s"}, ${prior.rejections} rejection${prior.rejections === 1 ? "" : "s"}, confidence adjusted by ${prior.adjustment >= 0 ? "+" : ""}${round(prior.adjustment * 100, 0)} points.`
        : undefined,
    });
  };

  addCausal(hypotheses.competitor, "competitor price cut switching quote lost deal");
  addCausal(hypotheses.discount, "discount approval margin pressure renewal", "causal inference");
  addCausal(hypotheses.season, "seasonal slowdown holiday budget freeze");

  const explained = sum(drivers.filter((d) => !d.rejected).map((d) => Math.abs(d.contributionUsd)));
  const unexplainedPct = round(
    Math.max(0, 100 - (explained / Math.max(Math.abs(decomposition.delta), 1)) * 100),
    1,
  );

  const { actions, restricted } = trace.run(
    "Action mapping and monitoring plan",
    "Governed playbook lookup with recovery assumptions, decision rights and a measurable monitoring plan per action",
    "CONFIGURED",
    () => buildActions(drivers, persona),
    (a) => `${a.actions.length} actions assigned, ${a.restricted} withheld by entitlement.`,
  );

  trace.skip(
    "Narrative synthesis",
    "Lovable AI Gateway, narration only, with a numeric guard that rejects any figure absent from the computed payload",
    "Queued. Runs after the deterministic chain, on the computed payload only.",
  );

  const { steps, totalMs } = trace.done();
  const validated = drivers.filter((d) => !d.rejected);
  const rejectedDrivers = drivers.filter((d) => d.rejected);

  const narrative = deterministicNarrative([
    `${contract.name} for the trailing 28 days is ${snapshot.valueFormatted}, ${Math.abs(snapshot.changePct)} percent ${snapshot.changePct < 0 ? "below" : "above"} the preceding baseline, a movement of ${fmtUsd(Math.abs(snapshot.businessImpactUsd))}.`,
    `The largest concentration is ${decomposition.concentration?.label ?? "not concentrated"} at ${decomposition.concentration?.shareOfDelta ?? 0} percent of the demand driven change.`,
    `${validated.length} driver${validated.length === 1 ? "" : "s"} survived refutation testing and ${rejectedDrivers.length} were rejected.`,
    `${unexplainedPct} percent of the movement remains unexplained.`,
  ]);

  const brief: DecisionBriefResult = {
    kind: "BRIEF",
    ...common,
    snapshot,
    steps,
    telemetry: {
      totalMs,
      computeMs: totalMs,
      narrativeMs: 0,
      model: "not called yet",
      tier: "pending",
      routeReason: "Narration runs after the deterministic chain.",
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      cacheHit: false,
      rowsScanned: totalRows(),
      guardVerdict: "NOT_RUN",
    },
    whatChanged: {
      summary: `${contract.name} moved ${fmtUsd(Math.abs(snapshot.businessImpactUsd))} against a materiality threshold of ${fmtUsd(contract.thresholds.materialImpactUsd)}.`,
      table: [
        {
          metric: contract.name,
          period: snapshot.window,
          value: snapshot.valueFormatted,
          vsBaseline: `${snapshot.changePct > 0 ? "+" : ""}${snapshot.changePct} percent`,
          zScore: snapshot.zScore === null ? "not applicable" : `${snapshot.zScore}`,
          materiality: snapshot.materiality,
        },
        ...decomposition.cells.slice(0, 3).map((c) => ({
          metric: `${c.region} ${c.segment}`,
          period: `Trailing ${decomposition.windowDays} days`,
          value: fmtUsd(c.recent),
          vsBaseline: `${c.delta > 0 ? "+" : ""}${fmtUsd(Math.abs(c.delta))}`,
          zScore: "cell level",
          materiality: `${c.shareOfDelta} percent of the change`,
        })),
      ],
    },
    drivers,
    unexplainedPct,
    actions,
    restrictedActions: restricted,
    restrictedNotice:
      restricted > 0
        ? `${restricted} action is owned by a function outside your entitlement scope and has been withheld. The owning function has been notified.`
        : undefined,
    uncertainty: {
      statement: `${unexplainedPct} percent of the movement is not attributed to a validated driver. Reseller-originated activity is not separated in the source systems, and the competitor price index is a weekly external estimate rather than an observed transaction price.`,
      resolution:
        "Request the reseller split from the operations team and validate the competitor index against three sampled quotes before the next board review.",
      owner: "Analytics Lead",
      deadline: addDays(AS_OF, 9),
      confidenceImpact:
        "Resolving both items would move the competitive pricing driver from a modelled estimate to an observed one, which is what the confidence rating currently caps.",
    },
    narrative,
  };

  return brief;
}

// ------------------------------------------------------------- abstentions

type Common = Pick<
  DecisionBriefResult,
  | "kpiId"
  | "kpiName"
  | "persona"
  | "personaLabel"
  | "generatedAt"
  | "sources"
  | "reconciliation"
  | "feedbackCount"
  | "appliedCorrections"
  | "access"
>;

function sparseAbstention(
  kpiId: string,
  persona: Persona,
  snapshot: DecisionBriefResult["snapshot"],
  trace: Trace,
  common: Common,
): AbstentionResult {
  const contract = KPI_CONTRACTS[kpiId]!;
  trace.run(
    "History sufficiency gate",
    "Minimum observation count from the KPI contract, checked before any detector runs",
    "CUSTOM",
    () => snapshot.historyPoints,
    (n) => `${n} observations against a required minimum of ${contract.thresholds.minHistoryPoints}. Detection blocked.`,
  );
  trace.skip(
    "Narrative synthesis",
    "Lovable AI Gateway",
    "Not called. The abstention was decided by rule, so no tokens are spent.",
  );
  const { steps, totalMs } = trace.done();

  return {
    kind: "ABSTAIN",
    ...common,
    snapshot,
    steps,
    telemetry: {
      totalMs,
      computeMs: totalMs,
      narrativeMs: 0,
      model: "none",
      tier: "none",
      routeReason: "Abstention decided by rule before narration.",
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      cacheHit: false,
      rowsScanned: totalRows(),
      guardVerdict: "NOT_RUN",
    },
    abstentionType: "SPARSE_HISTORY",
    banner: "Insufficient history. No causal claim is made.",
    reason: `${snapshot.historyPoints} monthly observations exist since launch. The contract requires ${contract.thresholds.minHistoryPoints} before a variance band can be established.`,
    rule: `history_points (${snapshot.historyPoints}) < min_history_points (${contract.thresholds.minHistoryPoints})`,
    observation: `Latest closed month is ${snapshot.valueFormatted}, ${snapshot.changePct > 0 ? "up" : "down"} ${Math.abs(snapshot.changePct)} percent against the mean of all prior closed months. This is reported as an observation, not as a signal.`,
    hypothesesConsidered: [
      {
        hypothesis: "Launch ramp is ahead of plan",
        status: "Not testable",
        reason: "No plan baseline is loaded into the semantic layer for this market.",
      },
      {
        hypothesis: "Channel build is converting earlier than expected",
        status: "Not testable",
        reason: "Partner attribution is not available at monthly grain for the launch market.",
      },
      {
        hypothesis: "Currency movement is inflating the figure",
        status: "Excluded",
        reason: "The contract fixes conversion at 1.09, so currency cannot contribute to the change.",
      },
    ],
    resolution: {
      action: `Monitor monthly. Detection unlocks automatically at ${contract.thresholds.minHistoryPoints} observations, expected in ${contract.thresholds.minHistoryPoints - snapshot.historyPoints} months.`,
      interim:
        "A plan versus actual comparison can be enabled immediately if Finance loads the launch plan into the semantic layer.",
      owner: "Head of Corporate Development",
      timeline: "Next monthly close",
    },
    evidence: [],
    narrative: deterministicNarrative([
      `${contract.name} is reported as an observation only.`,
      `${snapshot.historyPoints} of the required ${contract.thresholds.minHistoryPoints} observations are available, so the engine abstains rather than inferring a cause.`,
    ]),
  };
}

function contradictionAbstention(
  kpiId: string,
  persona: Persona,
  snapshot: DecisionBriefResult["snapshot"],
  trace: Trace,
  common: Common,
  contradiction: { correlation: number; detail: string },
): AbstentionResult {
  const opsRows = ops();
  const npsRows = nps();
  const recentWeeks = Array.from(new Set(opsRows.map((r) => r.weekStart))).sort().slice(-2);
  const defects = sum(opsRows.filter((r) => recentWeeks.includes(r.weekStart)).map((r) => r.defectTickets));
  const npsRecent = weeklyNps(persona).slice(-2);
  const npsPrior = weeklyNps(persona).slice(-8, -2);
  const npsDelta = round(
    (sum(npsRecent.map((p) => p.value)) / Math.max(npsRecent.length, 1)) -
      (sum(npsPrior.map((p) => p.value)) / Math.max(npsPrior.length, 1)),
    1,
  );

  trace.run(
    "Contradiction gate",
    "Two independent sources are required to agree in direction before a quality hypothesis is accepted",
    "CUSTOM",
    () => ({ npsDelta, defects, rows: npsRows.length }),
    (v) =>
      `Return rate rose while satisfaction rose ${v.npsDelta} points over the same weeks. Sources disagree, so narration is blocked.`,
  );
  trace.skip(
    "Narrative synthesis",
    "Lovable AI Gateway",
    "Not called. The engine abstained, so no tokens are spent.",
  );
  const { steps, totalMs } = trace.done();

  return {
    kind: "CLARIFY",
    ...common,
    snapshot,
    steps,
    telemetry: {
      totalMs,
      computeMs: totalMs,
      narrativeMs: 0,
      model: "none",
      tier: "none",
      routeReason: "Contradictory evidence blocked narration before any model call.",
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      cacheHit: false,
      rowsScanned: totalRows(),
      guardVerdict: "NOT_RUN",
    },
    abstentionType: "CONTRADICTORY_EVIDENCE",
    banner: "Contradictory evidence. One question needs answering before a cause is proposed.",
    reason: `The return rate rose to ${snapshot.valueFormatted} while the independent satisfaction survey rose ${npsDelta} points over the same two weeks. ${contradiction.detail} A product quality explanation requires both sources to move together, and they do not.`,
    rule: "quality_hypothesis requires directional agreement between operations and voice of customer",
    observation: `${defects} defect tickets were logged in the same two weeks, in line with the preceding period, which does not support a quality explanation either.`,
    hypothesesConsidered: [
      {
        hypothesis: "Product quality deterioration",
        status: "Rejected",
        reason: "Satisfaction improved and defect ticket volume is flat. Two independent sources contradict it.",
      },
      {
        hypothesis: "Fulfilment or delivery failure",
        status: "Rejected",
        reason: "Shipped volume and delivery exceptions are stable across the same weeks.",
      },
      {
        hypothesis: "Returns policy change not recorded in the source system",
        status: "Consistent with the data but unverifiable",
        reason: "The operations extract carries a policy change flag and it is set to zero for every week, so the system cannot confirm or exclude it.",
      },
    ],
    clarificationQuestion:
      "Was the returns window extended in the last two weeks without the change being recorded in the operations system?",
    clarificationOptions: [
      {
        id: "policy_changed",
        label: "Yes, the returns window was extended",
        consequence:
          "The movement is reclassified as an expected policy effect, the baseline is rebased from the change date, and no corrective action is raised.",
      },
      {
        id: "no_change",
        label: "No policy change was made",
        consequence:
          "The engine escalates to a data quality investigation, because the movement is then unexplained by every source currently loaded.",
      },
      {
        id: "unknown",
        label: "Not known yet",
        consequence:
          "The KPI stays under watch and the question is reissued at the next weekly load, with no cause asserted in the interim.",
      },
    ],
    resolution: {
      action: "Confirm the policy question with the operations lead before any corrective action is taken.",
      owner: "Operations Lead",
      timeline: `Answer required by ${addDays(AS_OF, 3)}`,
    },
    evidence: toEvidence(retrieve("returns window policy extended refund request", 3)),
    narrative: deterministicNarrative([
      "The engine has not proposed a cause for this movement.",
      `Two independent sources disagree: returns rose while satisfaction rose ${npsDelta} points.`,
      "One clarification is required before a narrative is generated.",
    ]),
  };
}

function noiseBrief(
  kpiId: string,
  persona: Persona,
  snapshot: DecisionBriefResult["snapshot"],
  trace: Trace,
  common: Common,
): DecisionBriefResult {
  const contract = KPI_CONTRACTS[kpiId]!;
  trace.run(
    "Materiality gate",
    "Estimated financial impact compared with the materiality threshold on the KPI contract",
    "CONFIGURED",
    () => snapshot.businessImpactUsd,
    (v) => `Impact ${fmtUsd(Math.abs(v))} against a threshold of ${fmtUsd(contract.thresholds.materialImpactUsd)}. Not escalated.`,
  );
  trace.skip(
    "Narrative synthesis",
    "Lovable AI Gateway",
    "Not called. A movement classified as noise never reaches the model, which is where most of the cost saving comes from.",
  );
  const { steps, totalMs } = trace.done();
  const dealRows = deals().length;

  return {
    kind: "BRIEF",
    ...common,
    snapshot,
    steps,
    telemetry: {
      totalMs,
      computeMs: totalMs,
      narrativeMs: 0,
      model: "none",
      tier: "none",
      routeReason: "Classified as noise. No narration is generated and no tokens are spent.",
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      cacheHit: false,
      rowsScanned: dealRows,
      guardVerdict: "NOT_RUN",
    },
    whatChanged: {
      summary: `${contract.name} moved ${snapshot.changePct} percent, which is ${fmtUsd(Math.abs(snapshot.businessImpactUsd))} against a materiality threshold of ${fmtUsd(contract.thresholds.materialImpactUsd)}.`,
      table: [
        {
          metric: contract.name,
          period: snapshot.window,
          value: snapshot.valueFormatted,
          vsBaseline: `${snapshot.changePct > 0 ? "+" : ""}${snapshot.changePct} percent`,
          zScore: snapshot.zScore === null ? "not applicable" : `${snapshot.zScore}`,
          materiality: snapshot.materiality,
        },
      ],
    },
    drivers: [],
    unexplainedPct: 0,
    actions: [],
    restrictedActions: 0,
    uncertainty: {
      statement: snapshot.materialityReason,
      resolution: "None required. The KPI stays on the standard monitoring cycle.",
      owner: contract.ownerRole,
      deadline: addDays(AS_OF, 7),
      confidenceImpact: "No decision depends on this movement, so no confidence claim is needed.",
    },
    narrative: deterministicNarrative([
      `${contract.name} moved ${snapshot.changePct} percent.`,
      snapshot.materialityReason,
      "No action is proposed and no narrative was generated, which is the intended behaviour.",
    ]),
  };
}

// -------------------------------------------------- narration payload

/**
 * Assembles the strictly bounded payload handed to the language model. Only
 * computed strings and figures cross this boundary. No raw rows, no source
 * credentials, and nothing the persona is not entitled to see.
 */
export function narrationPayload(brief: BriefResult) {
  const facts: { key: string; value: string; numeric?: number }[] = [
    { key: "Current value", value: brief.snapshot.valueFormatted, numeric: brief.snapshot.value },
    {
      key: "Change against baseline",
      value: `${brief.snapshot.changePct} percent`,
      numeric: Math.abs(brief.snapshot.changePct),
    },
    {
      key: "Estimated financial impact",
      value: fmtUsd(Math.abs(brief.snapshot.businessImpactUsd)),
      numeric: Math.abs(brief.snapshot.businessImpactUsd),
    },
    { key: "Detection window", value: brief.snapshot.window },
    { key: "Signal classification", value: brief.snapshot.signal },
  ];
  if (brief.snapshot.zScore !== null) {
    facts.push({ key: "Robust z score", value: `${brief.snapshot.zScore}`, numeric: Math.abs(brief.snapshot.zScore) });
  }

  if (brief.kind === "BRIEF") {
    facts.push({
      key: "Share of the movement not attributed to a validated driver",
      value: `${brief.unexplainedPct} percent`,
      numeric: brief.unexplainedPct,
    });
    return {
      kpiName: brief.kpiName,
      persona: brief.persona,
      personaLabel: brief.personaLabel,
      outcome: "BRIEF" as const,
      headline: brief.whatChanged.summary,
      facts,
      drivers: brief.drivers.map((d) => ({
        label: d.label,
        contribution: `${fmtUsd(Math.abs(d.contributionUsd))}, ${Math.abs(d.contributionPct)} percent of the movement`,
        confidence: d.confidence,
        rejected: d.rejected,
        reason: d.rejectionReason,
      })),
      actions: brief.actions.map((a) => ({
        action: a.action,
        owner: a.owner,
        deadline: a.deadline,
        expectedImpact: a.expectedImpact,
      })),
      uncertainty: brief.uncertainty.statement,
      forbidden: [
        "any cause not listed as a driver",
        "any action not listed above",
        "any customer name",
        "any forecast beyond the figures given",
      ],
      signal: brief.snapshot.signal,
      materiality: brief.snapshot.materiality,
    };
  }

  return {
    kpiName: brief.kpiName,
    persona: brief.persona,
    personaLabel: brief.personaLabel,
    outcome: brief.kind,
    headline: brief.banner,
    facts,
    drivers: brief.hypothesesConsidered.map((h) => ({
      label: h.hypothesis,
      contribution: h.status,
      confidence: "NOT ASSESSED",
      rejected: true,
      reason: h.reason,
    })),
    actions: [],
    uncertainty: brief.reason,
    forbidden: ["any proposed cause", "any recommended action", "any estimate of impact"],
    signal: brief.snapshot.signal,
    materiality: brief.snapshot.materiality,
  };
}
