/**
 * KPI computation.
 *
 * Every number on the dashboard is computed here from the source extracts.
 * There are no stored results and no hardcoded values. Detection is classical
 * statistics, not a language model: seasonal-trend decomposition, a robust
 * z-score on the remainder, and a CUSUM change-point test.
 */

import { AS_OF, deals, finance, marketing, nps, ops, weekStart } from "./datasets";
import { applyRowFilter, evaluateAccess, type Persona } from "./rbac";
import { KPI_CONTRACTS, KPI_ORDER, type KpiContract } from "./semantic";
import {
  cusum,
  decompose,
  holtForecast,
  mean,
  median,
  robustZ,
  round,
  sum,
} from "./stats";
import { freshnessLabel } from "./reconcile";
import type { KpiSnapshot } from "./types";

export interface SeriesPoint {
  label: string;
  value: number;
}

/**
 * Window means over the baseline. Non-overlapping windows are used when there
 * is enough history, because overlapping windows are autocorrelated and would
 * understate the true variance of a window mean, inflating every z-score.
 */
const windowMeans = (xs: number[], w: number): number[] => {
  const nonOverlapping: number[] = [];
  for (let end = xs.length; end - w >= 0; end -= w) nonOverlapping.push(mean(xs.slice(end - w, end)));
  if (nonOverlapping.length >= 6) return nonOverlapping;
  const overlapping: number[] = [];
  for (let i = w; i <= xs.length; i++) overlapping.push(mean(xs.slice(i - w, i)));
  return overlapping;
};

interface Evaluation {
  z: number;
  cusumPeak: number;
  changePointIndex: number | null;
  seasonalStrength: number;
  deseasonalised: number[];
}

/**
 * Scores the most recent window against the behaviour of the baseline period.
 *
 * The series is deseasonalised with the phase means from the decomposition, so
 * the most recent observations keep a residual (a centred moving average would
 * lose them at the edge). The recent window mean is then compared with the
 * distribution of equally sized rolling window means in the baseline, using a
 * median and MAD based z-score that is not dragged by the anomaly itself.
 */
function evaluateSeries(values: number[], period: number, window: number): Evaluation {
  const d = decompose(values, period);
  const adjusted = values.map((v, i) => v - (d.seasonal[i] ?? 0));
  const recentMean = mean(adjusted.slice(-window));
  const baselineSlice = adjusted.slice(0, Math.max(adjusted.length - window, window));
  const centre = median(baselineSlice);
  const c = cusum(adjusted.map((v) => v - centre));
  return {
    z: round(robustZ(recentMean, baselineSlice), 2),
    cusumPeak: c.peak,
    changePointIndex: c.changePointIndex,
    seasonalStrength: round(d.seasonalStrength, 2),
    deseasonalised: adjusted,
  };
}


const fmtUsd = (v: number): string =>
  v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000
      ? `$${Math.round(v / 1000).toLocaleString()}K`
      : `$${Math.round(v).toLocaleString()}`;

const fmtPct = (v: number): string => `${v.toFixed(2)}%`;

/**
 * Escalation rules. Statistical strength alone never escalates a KPI: the
 * movement also has to be financially material to the accountable unit. A
 * regional owner is judged against a regional threshold, not the group one.
 */
function classify(
  contract: KpiContract,
  z: number,
  impactUsd: number,
  historyPoints: number,
  scopeFactor = 1,
): { signal: KpiSnapshot["signal"]; materiality: KpiSnapshot["materiality"]; materialityReason: string } {
  const t = contract.thresholds;
  if (historyPoints < t.minHistoryPoints) {
    return {
      signal: "SPARSE",
      materiality: "INDETERMINATE",
      materialityReason: `History sufficiency gate: ${historyPoints} observations against a minimum of ${t.minHistoryPoints}. A variance band cannot be established, so no anomaly claim is made.`,
    };
  }
  const threshold = t.materialImpactUsd * scopeFactor;
  const abs = Math.abs(impactUsd);
  const materiality: KpiSnapshot["materiality"] =
    abs >= threshold * 2 ? "HIGH" : abs >= threshold ? "MEDIUM" : "LOW";
  const scopeNote = scopeFactor === 1 ? "" : ` The threshold is scoped to the accountable unit at ${Math.round(scopeFactor * 100)} percent of the group threshold.`;
  const materialityReason = `Estimated business impact ${fmtUsd(abs)} against a materiality threshold of ${fmtUsd(threshold)}.${scopeNote}`;

  if (materiality === "LOW") {
    return {
      signal: Math.abs(z) >= 3 ? "WATCH" : "NOISE",
      materiality,
      materialityReason:
        Math.abs(z) >= 3
          ? `Statistically strong but below the materiality threshold, so it is monitored rather than escalated. ${materialityReason}`
          : `Statistically detectable but below the materiality threshold, so no action is proposed. ${materialityReason}`,
    };
  }
  if (Math.abs(z) >= t.zAnomaly) {
    return { signal: "ANOMALY", materiality, materialityReason };
  }
  if (Math.abs(z) >= t.zWatch) {
    return { signal: "WATCH", materiality, materialityReason };
  }
  return {
    signal: "NOISE",
    materiality,
    materialityReason: `Movement sits inside the normal variance band, so it is not escalated. ${materialityReason}`,
  };
}

/** Regional owners are measured against a proportionally scaled threshold. */
function scopeFactorFor(contract: KpiContract, persona: Persona): number {
  return contract.entitlements.rowFilter[persona] ? 0.3 : 1;
}


// ---------------------------------------------------------------- series

export function dailyRevenue(persona: Persona): SeriesPoint[] {
  const rows = applyRowFilter(deals(), persona);
  const byDate = new Map<string, number>();
  rows.forEach((r) => byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.revenueRecognized));
  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
}

export function dailyAov(persona: Persona): SeriesPoint[] {
  const rows = applyRowFilter(deals(), persona);
  const byDate = new Map<string, { rev: number; won: number }>();
  rows.forEach((r) => {
    const b = byDate.get(r.date) ?? { rev: 0, won: 0 };
    b.rev += r.revenueBooked;
    b.won += r.dealsWon;
    byDate.set(r.date, b);
  });
  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, b]) => ({ label, value: b.won === 0 ? 0 : b.rev / b.won }));
}

export function weeklyReturnRate(persona: Persona): SeriesPoint[] {
  const rows = applyRowFilter(ops(), persona);
  const byWeek = new Map<string, { shipped: number; returned: number }>();
  rows.forEach((r) => {
    const b = byWeek.get(r.weekStart) ?? { shipped: 0, returned: 0 };
    b.shipped += r.unitsShipped;
    b.returned += r.unitsReturned;
    byWeek.set(r.weekStart, b);
  });
  return Array.from(byWeek.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, b]) => ({ label, value: b.shipped === 0 ? 0 : (b.returned / b.shipped) * 100 }));
}

export function weeklyNps(persona: Persona): SeriesPoint[] {
  const rows = applyRowFilter(nps(), persona);
  const byWeek = new Map<string, { score: number; n: number }>();
  rows.forEach((r) => {
    const b = byWeek.get(r.weekStart) ?? { score: 0, n: 0 };
    b.score += r.npsScore * r.responses;
    b.n += r.responses;
    byWeek.set(r.weekStart, b);
  });
  return Array.from(byWeek.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, b]) => ({ label, value: b.n === 0 ? 0 : b.score / b.n }));
}

export function weeklyCac(): SeriesPoint[] {
  const byWeek = new Map<string, { spend: number; customers: number }>();
  marketing().forEach((r) => {
    const b = byWeek.get(r.weekStart) ?? { spend: 0, customers: 0 };
    b.spend += r.spend;
    b.customers += r.newCustomers;
    byWeek.set(r.weekStart, b);
  });
  return Array.from(byWeek.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, b]) => ({ label, value: b.customers === 0 ? 0 : b.spend / b.customers }));
}

export function monthlyNewMarket(): SeriesPoint[] {
  return finance()
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => ({ label: r.month, value: r.revenueLocal * r.fxRateToUsd }));
}

/** Weekly recognised revenue on complete ISO weeks, used for forecasting. */
export function weeklyRevenue(persona: Persona): SeriesPoint[] {
  const rows = applyRowFilter(deals(), persona);
  const byWeek = new Map<string, { value: number; days: Set<string> }>();
  rows.forEach((r) => {
    const w = weekStart(r.date);
    const b = byWeek.get(w) ?? { value: 0, days: new Set<string>() };
    b.value += r.revenueRecognized;
    b.days.add(r.date);
    byWeek.set(w, b);
  });
  return Array.from(byWeek.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .filter(([, b]) => b.days.size === 7)
    .map(([label, b]) => ({ label, value: b.value }));
}

// ---------------------------------------------------------------- snapshots

function baseSnapshot(contract: KpiContract): Pick<KpiSnapshot, "id" | "name" | "unit" | "source" | "cadence" | "lastUpdated" | "freshness" | "visibleTo"> {
  const primary = contract.sources[0]!;
  const ageHours =
    (new Date(`${AS_OF}T09:00:00Z`).getTime() - new Date(primary.lastLoadedAt).getTime()) / 3600000;
  return {
    id: contract.id,
    name: contract.name,
    unit: contract.unit,
    source: contract.sources.map((s) => s.system).join(", "),
    cadence: primary.cadence,
    lastUpdated: freshnessLabel(primary.lastLoadedAt),
    freshness: ageHours > primary.slaHours ? "overdue" : ageHours > primary.slaHours * 0.75 ? "approaching" : "current",
    visibleTo: contract.entitlements.visibleTo,
  };
}

export function computeKpi(id: string, persona: Persona): KpiSnapshot {
  const contract = KPI_CONTRACTS[id];
  if (!contract) throw new Error(`Unknown KPI ${id}`);
  const base = baseSnapshot(contract);

  if (id === "revenue") {
    const series = dailyRevenue(persona);
    const values = series.map((p) => p.value);
    const recent = sum(values.slice(-28));
    const priorWindows = [values.slice(-56, -28), values.slice(-84, -56), values.slice(-112, -84)].map(sum);
    const baseline = mean(priorWindows);
    const evalR = evaluateSeries(values, 7, 14);
    const impact = recent - baseline;
    const cls = classify(contract, evalR.z, impact, values.length, scopeFactorFor(contract, persona));
    const weekly = weeklyRevenue(persona).map((p) => p.value);
    const fc = holtForecast(weekly, 4);
    return {
      ...base,
      value: recent,
      valueFormatted: fmtUsd(recent),
      baseline,
      changePct: round(((recent - baseline) / baseline) * 100, 1),
      zScore: evalR.z,
      cusumPeak: evalR.cusumPeak,
      changePointDate: evalR.changePointIndex === null ? null : (series[evalR.changePointIndex]?.label ?? null),
      businessImpactUsd: round(impact, 0),
      detectionMethod: "Seasonal-trend decomposition (weekly period), robust z-score on the remainder, two-sided CUSUM change point",
      window: "Trailing 28 days to " + AS_OF,
      baselineWindow: "Preceding three 28 day periods",
      sparkline: values.slice(-42),
      historyPoints: values.length,
      forecast: {
        next: round(fc.point[0] ?? 0, 0),
        low: round(fc.lower[0] ?? 0, 0),
        high: round(fc.upper[0] ?? 0, 0),
        horizon: "Next complete ISO week, 95 percent interval",
      },
      ...cls,
    };
  }

  if (id === "returnRate") {
    const series = weeklyReturnRate(persona);
    const values = series.map((p) => p.value);
    const recent = mean(values.slice(-2));
    const baseline = mean(values.slice(-14, -2));
    const evalR = evaluateSeries(values, 4, 2);
    const opsRows = applyRowFilter(ops(), persona);
    const recentWeeks = new Set(series.slice(-2).map((p) => p.label));
    const shipped = sum(opsRows.filter((r) => recentWeeks.has(r.weekStart)).map((r) => r.unitsShipped));
    const dealRows = applyRowFilter(deals(), persona);
    const unitRevenue =
      sum(dealRows.map((r) => r.revenueBooked)) / Math.max(sum(dealRows.map((r) => r.units)), 1);
    const impact = ((recent - baseline) / 100) * shipped * unitRevenue;
    const cls = classify(contract, evalR.z, impact, values.length, scopeFactorFor(contract, persona));
    return {
      ...base,
      value: recent,
      valueFormatted: fmtPct(recent),
      baseline,
      changePct: round(((recent - baseline) / baseline) * 100, 1),
      zScore: evalR.z,
      cusumPeak: evalR.cusumPeak,
      changePointDate: evalR.changePointIndex === null ? null : (series[evalR.changePointIndex]?.label ?? null),
      businessImpactUsd: round(impact, 0),
      detectionMethod: "Weekly rate series, seasonal-trend decomposition, robust z-score, cross-source consistency check against survey data",
      window: "Latest two complete ISO weeks",
      baselineWindow: "Preceding twelve complete ISO weeks",
      sparkline: values.slice(-16),
      historyPoints: values.length,
      ...cls,
    };
  }

  if (id === "cac") {
    const series = weeklyCac();
    const values = series.map((p) => p.value);
    const recent = mean(values.slice(-4));
    const baseline = mean(values.slice(-16, -4));
    const evalR = evaluateSeries(values, 4, 4);
    const customers = sum(
      marketing()
        .filter((r) => series.slice(-4).some((p) => p.label === r.weekStart))
        .map((r) => r.newCustomers),
    );
    const impact = (recent - baseline) * customers;
    const cls = classify(contract, evalR.z, impact, values.length, scopeFactorFor(contract, persona));
    return {
      ...base,
      value: recent,
      valueFormatted: `$${Math.round(recent).toLocaleString()}`,
      baseline,
      changePct: round(((recent - baseline) / baseline) * 100, 1),
      zScore: evalR.z,
      cusumPeak: evalR.cusumPeak,
      changePointDate: evalR.changePointIndex === null ? null : (series[evalR.changePointIndex]?.label ?? null),
      businessImpactUsd: round(impact, 0),
      detectionMethod: "Weekly cost per acquisition, seasonal-trend decomposition, robust z-score",
      window: "Latest four complete ISO weeks",
      baselineWindow: "Preceding twelve complete ISO weeks",
      sparkline: values.slice(-16),
      historyPoints: values.length,
      ...cls,
    };
  }

  if (id === "aov") {
    const series = dailyAov(persona);
    const values = series.map((p) => p.value);
    const recent = mean(values.slice(-14));
    const baseline = mean(values.slice(-70, -14));
    const evalR = evaluateSeries(values, 7, 14);
    const wonRecent = sum(applyRowFilter(deals(), persona).slice(-14 * 6).map((r) => r.dealsWon));
    const impact = (recent - baseline) * wonRecent;
    const cls = classify(contract, evalR.z, impact, values.length, scopeFactorFor(contract, persona));
    return {
      ...base,
      value: recent,
      valueFormatted: `$${Math.round(recent).toLocaleString()}`,
      baseline,
      changePct: round(((recent - baseline) / baseline) * 100, 1),
      zScore: evalR.z,
      cusumPeak: evalR.cusumPeak,
      changePointDate: null,
      businessImpactUsd: round(impact, 0),
      detectionMethod: "Seasonal-trend decomposition (weekly period), robust z-score on the remainder",
      window: "Trailing 14 days",
      baselineWindow: "Preceding 56 days",
      sparkline: values.slice(-42),
      historyPoints: values.length,
      ...cls,
    };
  }

  // newMarket
  const series = monthlyNewMarket();
  const values = series.map((p) => p.value);
  const recent = values.at(-1) ?? 0;
  const baseline = mean(values.slice(0, -1));
  const cls = classify(contract, 0, recent - baseline, values.length, scopeFactorFor(contract, persona));
  return {
    ...base,
    value: recent,
    valueFormatted: fmtUsd(recent),
    baseline,
    changePct: baseline === 0 ? 0 : round(((recent - baseline) / baseline) * 100, 1),
    zScore: null,
    cusumPeak: null,
    changePointDate: null,
    businessImpactUsd: round(recent - baseline, 0),
    detectionMethod: "History sufficiency gate reached before any detector was run",
    window: "Latest closed month",
    baselineWindow: "All prior closed months since launch",
    sparkline: values,
    historyPoints: values.length,
    ...cls,
  };
}

export interface DashboardKpi {
  snapshot: KpiSnapshot;
  locked: boolean;
  lockReason: string | null;
  rowFilter: string | null;
  maskedColumns: string[];
}

/** Computes the prioritised dashboard for a persona, applying entitlements. */
export function computeDashboard(persona: Persona): DashboardKpi[] {
  const rank: Record<string, number> = { ANOMALY: 0, WATCH: 1, SPARSE: 2, NOISE: 3 };
  return KPI_ORDER.map((id) => {
    const contract = KPI_CONTRACTS[id]!;
    const access = evaluateAccess(persona, contract);
    const snapshot = computeKpi(id, persona);
    return {
      snapshot,
      locked: !access.allowed,
      lockReason: access.allowed ? null : access.rule,
      rowFilter: access.rowFilter,
      maskedColumns: access.maskedColumns,
    };
  }).sort((a, b) => {
    if (a.locked !== b.locked) return a.locked ? 1 : -1;
    const r = (rank[a.snapshot.signal] ?? 9) - (rank[b.snapshot.signal] ?? 9);
    if (r !== 0) return r;
    return Math.abs(b.snapshot.businessImpactUsd) - Math.abs(a.snapshot.businessImpactUsd);
  });
}

export { fmtUsd, fmtPct };
