/**
 * Governed KPI semantic layer.
 *
 * This is the single source of truth for what a KPI means, how it is
 * calculated, which systems it comes from, when it is considered material and
 * who is allowed to see it. Nothing downstream is permitted to redefine a KPI.
 * Custom-built layer: no vendor semantic model is assumed.
 */

import type { Persona } from "./rbac";

export type Capability = "NATIVE" | "CONFIGURED" | "CUSTOM" | "EXTERNAL";

export interface LineageNode {
  id: string;
  label: string;
  kind: "source" | "transform" | "metric";
  detail: string;
  capability: Capability;
}

export interface SourceContract {
  system: string;
  dataset: string;
  grain: string;
  cadence: "Daily" | "Weekly" | "Monthly";
  slaHours: number;
  lastLoadedAt: string;
  qualityNotes: string;
}

export interface KpiContract {
  id: string;
  name: string;
  definition: string;
  formula: string;
  grain: string;
  reportingCalendar: string;
  unit: string;
  direction: "up_is_good" | "down_is_good";
  ownerRole: string;
  sources: SourceContract[];
  lineage: LineageNode[];
  drivers: string[];
  thresholds: {
    zWatch: number;
    zAnomaly: number;
    materialImpactUsd: number;
    minHistoryPoints: number;
  };
  entitlements: {
    visibleTo: Persona[];
    rowFilter: Partial<Record<Persona, string>>;
    maskedColumns: Partial<Record<Persona, string[]>>;
    domain: string;
    classification: "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
  };
  knownConflicts?: string;
}

const CRM_DAILY: SourceContract = {
  system: "CRM (Salesforce-equivalent)",
  dataset: "crm_deals_daily.csv",
  grain: "date x region x segment",
  cadence: "Daily",
  slaHours: 6,
  lastLoadedAt: "2026-08-29T07:10:00Z",
  qualityNotes: "Complete for the analysis window. Invoice delay flag added during the billing migration.",
};

const MARKETING_WEEKLY: SourceContract = {
  system: "Marketing platform",
  dataset: "marketing_spend_weekly.csv",
  grain: "ISO week x channel",
  cadence: "Weekly",
  slaHours: 72,
  lastLoadedAt: "2026-08-26T04:00:00Z",
  qualityNotes: "Weekly grain only. Daily attribution is not available, so CAC cannot be computed intra-week.",
};

const OPS_WEEKLY: SourceContract = {
  system: "Operations and returns",
  dataset: "ops_returns_weekly.csv",
  grain: "ISO week x region",
  cadence: "Weekly",
  slaHours: 48,
  lastLoadedAt: "2026-08-28T02:30:00Z",
  qualityNotes: "Reseller-originated returns are not separated from direct returns.",
};

const NPS_WEEKLY: SourceContract = {
  system: "Voice of customer platform",
  dataset: "nps_weekly.csv",
  grain: "ISO week x region",
  cadence: "Weekly",
  slaHours: 72,
  lastLoadedAt: "2026-08-28T06:00:00Z",
  qualityNotes: "Survey response base varies week to week. Independent of the operations system.",
};

const FINANCE_MONTHLY: SourceContract = {
  system: "Finance ledger",
  dataset: "finance_newmarket_monthly.csv",
  grain: "calendar month x market",
  cadence: "Monthly",
  slaHours: 336,
  lastLoadedAt: "2026-08-17T09:00:00Z",
  qualityNotes: "Reported in EUR and converted at a fixed contract rate. Six months of history only.",
};

export const KPI_CONTRACTS: Record<string, KpiContract> = {
  revenue: {
    id: "revenue",
    name: "Total Revenue",
    definition:
      "Recognised revenue from closed-won deals, measured on a trailing 28 day window and compared with the preceding 84 day baseline.",
    formula: "SUM(revenue_recognized) over the trailing 28 days, by region and segment",
    grain: "date x region x segment, rolled up to company",
    reportingCalendar: "Gregorian, ISO weeks, Monday start",
    unit: "USD",
    direction: "up_is_good",
    ownerRole: "Chief Financial Officer",
    sources: [CRM_DAILY, MARKETING_WEEKLY, { ...OPS_WEEKLY, qualityNotes: "Used only as a control variable." }],
    lineage: [
      { id: "l1", label: "CRM deal ledger", kind: "source", detail: "crm_deals_daily.csv, daily load, 6 hour SLA", capability: "EXTERNAL" },
      { id: "l2", label: "Grain alignment", kind: "transform", detail: "Daily rows aligned to ISO weeks for joins with weekly sources", capability: "CUSTOM" },
      { id: "l3", label: "Recognition rule", kind: "transform", detail: "Booked revenue is recognised on invoice issue date, not order date", capability: "CONFIGURED" },
      { id: "l4", label: "Total Revenue", kind: "metric", detail: "Trailing 28 day sum vs 84 day baseline", capability: "CUSTOM" },
    ],
    drivers: ["price", "volume", "mix", "win rate", "invoice timing", "seasonality", "competition"],
    thresholds: { zWatch: 1.5, zAnomaly: 2.0, materialImpactUsd: 150000, minHistoryPoints: 24 },
    entitlements: {
      visibleTo: ["CFO", "RSM"],
      rowFilter: { RSM: "region = 'South'" },
      maskedColumns: { RSM: ["company_total", "margin"] },
      domain: "Finance",
      classification: "CONFIDENTIAL",
    },
  },
  aov: {
    id: "aov",
    name: "Average Order Value",
    definition: "Recognised revenue divided by closed-won deals over the trailing 28 day window.",
    formula: "SUM(revenue_recognized) / SUM(deals_won) over the trailing 28 days",
    grain: "date x region x segment, rolled up to company",
    reportingCalendar: "Gregorian, ISO weeks, Monday start",
    unit: "USD",
    direction: "up_is_good",
    ownerRole: "VP Sales",
    sources: [CRM_DAILY],
    lineage: [
      { id: "l1", label: "CRM deal ledger", kind: "source", detail: "crm_deals_daily.csv", capability: "EXTERNAL" },
      { id: "l2", label: "Ratio metric guard", kind: "transform", detail: "Deals with zero wins excluded from the denominator", capability: "CUSTOM" },
      { id: "l3", label: "Average Order Value", kind: "metric", detail: "Trailing 28 day ratio vs 84 day baseline", capability: "CUSTOM" },
    ],
    drivers: ["price", "mix", "discounting"],
    thresholds: { zWatch: 1.5, zAnomaly: 2.0, materialImpactUsd: 120000, minHistoryPoints: 24 },
    entitlements: {
      visibleTo: ["CFO"],
      rowFilter: {},
      maskedColumns: {},
      domain: "Finance",
      classification: "CONFIDENTIAL",
    },

  },
  cac: {
    id: "cac",
    name: "Customer Acquisition Cost",
    definition:
      "Blended paid acquisition spend divided by new customers acquired, measured on complete ISO weeks.",
    formula: "SUM(spend) / SUM(new_customers) over the trailing 4 complete weeks",
    grain: "ISO week x channel",
    reportingCalendar: "ISO weeks, Monday start. Not comparable to the daily finance calendar without alignment.",
    unit: "USD per customer",
    direction: "down_is_good",
    ownerRole: "VP Marketing",
    sources: [MARKETING_WEEKLY],
    lineage: [
      { id: "l1", label: "Marketing platform export", kind: "source", detail: "marketing_spend_weekly.csv, weekly load, 72 hour SLA", capability: "EXTERNAL" },
      { id: "l2", label: "Channel rollup", kind: "transform", detail: "Paid and partner channels summed, organic excluded by definition", capability: "CONFIGURED" },
      { id: "l3", label: "Customer Acquisition Cost", kind: "metric", detail: "Trailing 4 week ratio vs prior 12 week baseline", capability: "CUSTOM" },
    ],
    drivers: ["spend", "lead volume", "lead to customer conversion", "channel mix"],
    thresholds: { zWatch: 1.5, zAnomaly: 2.0, materialImpactUsd: 60000, minHistoryPoints: 12 },
    entitlements: {
      visibleTo: ["CFO", "RSM"],
      rowFilter: {},
      maskedColumns: { RSM: ["spend_by_channel"] },
      domain: "Marketing",
      classification: "CONFIDENTIAL",
    },
  },
  returnRate: {
    id: "returnRate",
    name: "Product Return Rate",
    definition: "Units returned divided by units shipped, on complete ISO weeks, all regions.",
    formula: "SUM(units_returned) / SUM(units_shipped) over the trailing 2 complete weeks",
    grain: "ISO week x region",
    reportingCalendar: "ISO weeks, Monday start",
    unit: "percent",
    direction: "down_is_good",
    ownerRole: "COO",
    sources: [OPS_WEEKLY, NPS_WEEKLY],
    lineage: [
      { id: "l1", label: "Operations returns log", kind: "source", detail: "ops_returns_weekly.csv, weekly load, 48 hour SLA", capability: "EXTERNAL" },
      { id: "l2", label: "Voice of customer", kind: "source", detail: "nps_weekly.csv, independent weekly survey", capability: "EXTERNAL" },
      { id: "l3", label: "Cross-source consistency check", kind: "transform", detail: "Return rate and satisfaction are expected to move in opposite directions", capability: "CUSTOM" },
      { id: "l4", label: "Product Return Rate", kind: "metric", detail: "Trailing 2 week ratio vs prior 12 week baseline", capability: "CUSTOM" },
    ],
    drivers: ["product quality", "returns policy", "channel mix", "shipping damage"],
    thresholds: { zWatch: 1.5, zAnomaly: 2.0, materialImpactUsd: 90000, minHistoryPoints: 12 },
    entitlements: {
      visibleTo: ["CFO"],
      rowFilter: {},
      maskedColumns: {},
      domain: "Operations",
      classification: "RESTRICTED",
    },
    knownConflicts:
      "Returns are sourced from the operations system while satisfaction is sourced from the survey platform. Reseller returns are not separated in either source.",
  },
  newMarket: {
    id: "newMarket",
    name: "New Market Revenue",
    definition: "Recognised revenue in the DACH launch market, reported monthly in EUR and converted to USD.",
    formula: "SUM(revenue_local) * fx_rate_to_usd for the latest closed month",
    grain: "calendar month x market",
    reportingCalendar: "Calendar months. The launch market closes 12 days after month end.",
    unit: "USD",
    direction: "up_is_good",
    ownerRole: "Chief Financial Officer",
    sources: [FINANCE_MONTHLY],
    lineage: [
      { id: "l1", label: "Finance ledger export", kind: "source", detail: "finance_newmarket_monthly.csv, monthly load", capability: "EXTERNAL" },
      { id: "l2", label: "Currency normalisation", kind: "transform", detail: "EUR converted at the contracted rate of 1.09", capability: "CONFIGURED" },
      { id: "l3", label: "History sufficiency gate", kind: "transform", detail: "Fewer than 24 points blocks anomaly classification", capability: "CUSTOM" },
      { id: "l4", label: "New Market Revenue", kind: "metric", detail: "Latest closed month, USD", capability: "CUSTOM" },
    ],
    drivers: ["launch ramp", "channel build", "pricing entry strategy"],
    thresholds: { zWatch: 1.5, zAnomaly: 2.0, materialImpactUsd: 40000, minHistoryPoints: 24 },
    entitlements: {
      visibleTo: ["CFO"],
      rowFilter: {},
      maskedColumns: {},
      domain: "Finance",
      classification: "RESTRICTED",
    },
  },
};

export const KPI_ORDER = ["revenue", "returnRate", "cac", "newMarket", "aov"];

/**
 * Capability register. Round 2 asks teams to distinguish what is native to a
 * platform, what is configured, what is custom built and what is integrated.
 */
export const CAPABILITY_REGISTER: {
  capability: string;
  classification: Capability;
  note: string;
}[] = [
  { capability: "Source system extracts (CRM, marketing, operations, survey, ledger)", classification: "EXTERNAL", note: "Modelled here as CSV extracts with their real cadences and grains." },
  { capability: "KPI semantic contract and thresholds", classification: "CONFIGURED", note: "Declarative contract in src/engine/semantic.ts, versioned with the code." },
  { capability: "Anomaly detection, contribution analysis, causal estimation, forecasting", classification: "CUSTOM", note: "Implemented in TypeScript in src/engine and executed in the browser and on the server." },
  { capability: "Evidence retrieval over notes and tickets", classification: "CUSTOM", note: "TF-IDF with cosine similarity, no vector database required at this scale." },
  { capability: "Narrative synthesis and numeric guard", classification: "EXTERNAL", note: "Lovable AI Gateway. Narration only, with a validator agent that rejects any number not present in the computed payload." },
  { capability: "Entitlements, masking and audit trail", classification: "CUSTOM", note: "Row, column and domain rules evaluated before any payload reaches the model." },
];
