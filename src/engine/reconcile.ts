/**
 * Cross-source reconciliation.
 *
 * Sources arrive at different grains and cadences, with different history
 * depth and different definitions of a period. This module aligns them,
 * records every alignment decision, scores data quality and reports freshness
 * against each source SLA. All of it is deterministic.
 */

import { AS_OF, deals, finance, marketing, nps, ops, signals, weekStart } from "./datasets";
import type { KpiContract } from "./semantic";
import type { ReconciliationNote, SourceStatus } from "./types";

const HOUR = 3600 * 1000;

const rowsFor = (dataset: string): number => {
  switch (dataset) {
    case "crm_deals_daily.csv":
      return deals().length;
    case "marketing_spend_weekly.csv":
      return marketing().length;
    case "ops_returns_weekly.csv":
      return ops().length;
    case "nps_weekly.csv":
      return nps().length;
    case "finance_newmarket_monthly.csv":
      return finance().length;
    case "market_signals_weekly.csv":
      return signals().length;
    default:
      return 0;
  }
};

function completeness(dataset: string): number {
  switch (dataset) {
    case "crm_deals_daily.csv": {
      const rows = deals();
      const missing = rows.filter((r) => !r.date || r.revenueBooked < 0).length;
      return 1 - missing / Math.max(rows.length, 1);
    }
    case "ops_returns_weekly.csv": {
      const rows = ops();
      const missing = rows.filter((r) => r.unitsShipped <= 0).length;
      return 1 - missing / Math.max(rows.length, 1);
    }
    default:
      return 1;
  }
}

export function sourceStatuses(contract: KpiContract): SourceStatus[] {
  const now = new Date(`${AS_OF}T09:00:00Z`).getTime();
  return contract.sources.map((s) => {
    const ageHours = Math.max(0, Math.round((now - new Date(s.lastLoadedAt).getTime()) / HOUR));
    const ratio = ageHours / s.slaHours;
    const status: SourceStatus["status"] = ratio > 1 ? "overdue" : ratio > 0.75 ? "approaching" : "current";
    const rows = rowsFor(s.dataset);
    const quality = Math.round(completeness(s.dataset) * 100) / 100;
    return {
      system: s.system,
      dataset: s.dataset,
      cadence: s.cadence,
      grain: s.grain,
      lastLoadedAt: s.lastLoadedAt,
      ageHours,
      slaHours: s.slaHours,
      status,
      qualityScore: quality,
      qualityNotes: s.qualityNotes,
      rows,
    };
  });
}

/** Human readable freshness, for example "9 hours ago" or "12 days ago". */
export function freshnessLabel(lastLoadedAt: string): string {
  const now = new Date(`${AS_OF}T09:00:00Z`).getTime();
  const hours = Math.max(0, Math.round((now - new Date(lastLoadedAt).getTime()) / HOUR));
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * Aligns a daily series onto ISO weeks so that daily CRM data can be joined to
 * weekly marketing, operations and market-signal sources without double
 * counting or partial weeks.
 */
export function alignDailyToWeekly<T extends { date: string }>(
  rows: T[],
  value: (row: T) => number,
): { weekStart: string; value: number; days: number }[] {
  const buckets = new Map<string, { value: number; days: Set<string> }>();
  rows.forEach((r) => {
    const w = weekStart(r.date);
    const b = buckets.get(w) ?? { value: 0, days: new Set<string>() };
    b.value += value(r);
    b.days.add(r.date);
    buckets.set(w, b);
  });
  return Array.from(buckets.entries())
    .map(([w, b]) => ({ weekStart: w, value: b.value, days: b.days.size }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .filter((w) => w.days === 7);
}

export function reconciliationNotes(kpiId: string): ReconciliationNote[] {
  const common: ReconciliationNote[] = [
    {
      issue: "Sources refresh on different cadences (daily CRM, weekly marketing and operations, monthly ledger).",
      resolution: "Every cross-source comparison is made on complete ISO weeks. Partial weeks are excluded rather than extrapolated.",
      method: "Deterministic grain alignment",
    },
  ];

  if (kpiId === "revenue") {
    return [
      ...common,
      {
        issue: "Booked revenue and recognised revenue diverged during the billing platform migration.",
        resolution: "The contract recognises revenue on invoice issue date. The gap between booked and recognised is reported as a separate timing driver instead of being smoothed away.",
        method: "Business rule from the semantic contract",
      },
      {
        issue: "CRM region labels and finance region labels use different codes for the same territory.",
        resolution: "Mapped through the region dimension in the semantic layer before aggregation.",
        method: "Deterministic dimension mapping",
      },
    ];
  }
  if (kpiId === "returnRate") {
    return [
      ...common,
      {
        issue: "Returns come from the operations system and satisfaction from an independent survey platform.",
        resolution: "Both are aligned to ISO weeks and checked for directional consistency. A conflicting direction blocks narrative generation.",
        method: "Cross-source consistency rule",
      },
      {
        issue: "Reseller returns are not separated from direct returns in either source.",
        resolution: "Recorded as a known data gap on the KPI contract and surfaced in the brief rather than silently ignored.",
        method: "Data quality register",
      },
    ];
  }
  if (kpiId === "newMarket") {
    return [
      ...common,
      {
        issue: "The launch market reports in EUR while the group reports in USD.",
        resolution: "Converted at the contracted rate of 1.09 recorded in the semantic contract, not at a spot rate.",
        method: "Configured currency rule",
      },
      {
        issue: "Only six monthly observations exist since launch.",
        resolution: "The history sufficiency gate blocks anomaly classification below 24 points.",
        method: "Business rule",
      },
    ];
  }
  if (kpiId === "cac") {
    return [
      ...common,
      {
        issue: "Marketing reports on ISO weeks while finance reports on calendar months.",
        resolution: "CAC is computed on complete ISO weeks only and never blended with month to date finance figures.",
        method: "Calendar reconciliation",
      },
    ];
  }
  return common;
}
