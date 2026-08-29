import type { Persona } from "./rbac";

export type Signal = "ANOMALY" | "WATCH" | "NOISE" | "SPARSE" | "LOCKED";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type MethodType = "NON-LLM" | "LLM";

export interface EvidenceItem {
  noteId: string;
  source: "CRM" | "Tickets";
  date: string;
  authorRole: string;
  text: string;
  score: number;
}

export interface Refutation {
  name: string;
  detail: string;
  passed: boolean;
}

export interface DriverFinding {
  id: string;
  label: string;
  method: string;
  methodType: MethodType;
  methodFamily: "statistics" | "causal inference" | "business rule" | "accounting" | "retrieval";
  contributionUsd: number;
  contributionPct: number;
  confidence: Confidence;
  confidenceScore: number;
  effect: { estimate: number; ciLow: number; ciHigh: number; pValue: number; unit: string };
  refutations: Refutation[];
  evidence: EvidenceItem[];
  rejected: boolean;
  rejectionReason?: string;
  priorNote?: string;
}

export interface MonitoringPlan {
  metric: string;
  source: string;
  frequency: string;
  threshold: string;
  owner: string;
  firstReview: string;
}

export interface ActionRec {
  rank: number;
  driverId: string;
  driver: string;
  lever: string;
  action: string;
  expectedImpactUsd: number;
  expectedImpact: string;
  owner: string;
  deadline: string;
  confidence: Confidence;
  decisionRights: string;
  visibleTo: Persona[];
  constraint: string;
  monitoring: MonitoringPlan;
}

export interface StepTrace {
  step: string;
  method: string;
  type: MethodType;
  capability: "NATIVE" | "CONFIGURED" | "CUSTOM" | "EXTERNAL";
  durationMs: number;
  result: string;
  skipped?: boolean;
}

export interface TelemetryRecord {
  totalMs: number;
  computeMs: number;
  narrativeMs: number;
  model: string;
  tier: string;
  routeReason: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  cacheHit: boolean;
  rowsScanned: number;
  guardVerdict: "PASSED" | "REPAIRED" | "NOT_RUN";
}

export interface SourceStatus {
  system: string;
  dataset: string;
  cadence: string;
  grain: string;
  lastLoadedAt: string;
  ageHours: number;
  slaHours: number;
  status: "current" | "approaching" | "overdue";
  qualityScore: number;
  qualityNotes: string;
  rows: number;
}

export interface ReconciliationNote {
  issue: string;
  resolution: string;
  method: string;
}

export interface KpiSnapshot {
  id: string;
  name: string;
  value: number;
  valueFormatted: string;
  unit: string;
  baseline: number;
  changePct: number;
  signal: Exclude<Signal, "LOCKED">;
  zScore: number | null;
  cusumPeak: number | null;
  changePointDate: string | null;
  materiality: "HIGH" | "MEDIUM" | "LOW" | "INDETERMINATE";
  materialityReason: string;
  businessImpactUsd: number;
  detectionMethod: string;
  window: string;
  baselineWindow: string;
  sparkline: number[];
  historyPoints: number;
  source: string;
  cadence: string;
  lastUpdated: string;
  freshness: "current" | "approaching" | "overdue";
  forecast?: { next: number; low: number; high: number; horizon: string };
  visibleTo: Persona[];
}

export interface WhatChangedRow {
  metric: string;
  period: string;
  value: string;
  vsBaseline: string;
  zScore: string;
  materiality: string;
}

export interface BriefBase {
  kpiId: string;
  kpiName: string;
  persona: Persona;
  personaLabel: string;
  generatedAt: string;
  telemetry: TelemetryRecord;
  steps: StepTrace[];
  sources: SourceStatus[];
  reconciliation: ReconciliationNote[];
  feedbackCount: number;
  appliedCorrections: string[];
  access: { rowFilter: string | null; maskedColumns: string[]; rule: string };
  narrative: { text: string; source: "LLM" | "DETERMINISTIC_TEMPLATE"; guard: string };
}

export interface DecisionBriefResult extends BriefBase {
  kind: "BRIEF";
  snapshot: KpiSnapshot;
  whatChanged: { summary: string; table: WhatChangedRow[] };
  drivers: DriverFinding[];
  unexplainedPct: number;
  actions: ActionRec[];
  restrictedActions: number;
  restrictedNotice?: string;
  uncertainty: {
    statement: string;
    resolution: string;
    owner: string;
    deadline: string;
    confidenceImpact: string;
  };
}

export interface AbstentionResult extends BriefBase {
  kind: "ABSTAIN" | "CLARIFY";
  snapshot: KpiSnapshot;
  abstentionType: "SPARSE_HISTORY" | "CONTRADICTORY_EVIDENCE" | "LOW_CONFIDENCE";
  banner: string;
  reason: string;
  rule: string;
  observation: string;
  hypothesesConsidered: { hypothesis: string; status: string; reason: string }[];
  clarificationQuestion?: string;
  clarificationOptions?: { id: string; label: string; consequence: string }[];
  resolution: { action: string; interim?: string; owner: string; timeline: string };
  evidence: EvidenceItem[];
}

export type BriefResult = DecisionBriefResult | AbstentionResult;
