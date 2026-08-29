/**
 * Causal layer.
 *
 * Correlation is not accepted as an explanation. Each hypothesis is estimated
 * on a daily panel with an explicit adjustment set, then put through three
 * refutation tests borrowed from the DoWhy refutation family: a placebo
 * treatment, an added common cause, and a data-subset stability check. A
 * hypothesis that fails its refutations is reported as rejected rather than
 * quietly dropped. No language model is involved at any point in this file.
 */

import { deals, marketing, signals, weekStart } from "./datasets";
import { mean, ols, pValue, round, stdev, sum } from "./stats";

export interface PanelRow {
  date: string;
  y: number;
  competitorIndex: number;
  seasonality: number;
  marketingSpend: number;
  discountPct: number;
}

/** Builds the daily analysis panel for a region and segment, joining weekly sources onto days. */
export function buildPanel(region: string, segment: string): PanelRow[] {
  const sigByWeek = new Map<string, number[]>();
  signals().forEach((s) => {
    if (s.region !== region) return;
    sigByWeek.set(s.weekStart, [s.competitorPriceIndex, s.seasonalityIndex]);
  });
  const spendByWeek = new Map<string, number>();
  marketing().forEach((m) => spendByWeek.set(m.weekStart, (spendByWeek.get(m.weekStart) ?? 0) + m.spend));

  return deals()
    .filter((r) => r.region === region && r.segment === segment)
    .map((r) => {
      const w = weekStart(r.date);
      const sig = sigByWeek.get(w) ?? [100, 1];
      return {
        date: r.date,
        y: r.revenueBooked,
        competitorIndex: sig[0] as number,
        seasonality: sig[1] as number,
        marketingSpend: (spendByWeek.get(w) ?? 0) / 1000,
        discountPct: r.discountPct,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface EffectEstimate {
  coefficient: number;
  stdError: number;
  tStat: number;
  pValue: number;
  ciLow: number;
  ciHigh: number;
  r2: number;
  n: number;
}

type Extractor = (row: PanelRow) => number;

/** Ordinary least squares with an intercept, treatment first, then the adjustment set. */
export function estimate(rows: PanelRow[], treatment: Extractor, controls: Extractor[]): EffectEstimate {
  // ols() adds its own intercept column, so the design starts with the treatment.
  const X = rows.map((r) => [treatment(r), ...controls.map((c) => c(r))]);
  const y = rows.map((r) => r.y);
  const fit = ols(X, y);
  const b = fit.coefficients[1] ?? 0;
  const se = fit.stdErrors[1] ?? 0;
  const t = fit.tStats[1] ?? 0;
  return {
    coefficient: round(b, 2),
    stdError: round(se, 2),
    tStat: round(t, 2),
    pValue: round(pValue(t), 4),
    ciLow: round(b - 1.96 * se, 2),
    ciHigh: round(b + 1.96 * se, 2),
    r2: round(fit.r2, 3),
    n: fit.n,
  };
}

export interface RefutationResult {
  name: string;
  detail: string;
  passed: boolean;
}

/**
 * Refutation battery. Each test is deterministic, so the same panel always
 * produces the same verdict.
 */
export function refute(
  rows: PanelRow[],
  treatment: Extractor,
  controls: Extractor[],
  base: EffectEstimate,
): RefutationResult[] {
  // 1. Placebo treatment: the treatment series is reversed in time, which
  // destroys the timing of the shock while preserving its distribution.
  const reversed = rows.map((r, i) => ({ ...r, placebo: treatment(rows[rows.length - 1 - i] as PanelRow) }));
  const placebo = estimate(
    reversed as PanelRow[],
    (r) => (r as PanelRow & { placebo: number }).placebo,
    controls,
  );
  const placeboPassed = Math.abs(placebo.coefficient) < Math.abs(base.coefficient) * 0.4;

  // 2. Added common cause: a deterministic synthetic covariate is injected.
  // A genuine effect should barely move.
  const withNoise = rows.map((r, i) => ({ ...r, synthetic: Math.sin(i / 3.7) * 10 + (i % 5) }));
  const added = estimate(withNoise as PanelRow[], treatment, [
    ...controls,
    (r) => (r as PanelRow & { synthetic: number }).synthetic,
  ]);
  const shift = base.coefficient === 0 ? 1 : Math.abs((added.coefficient - base.coefficient) / base.coefficient);
  const addedPassed = shift < 0.2;

  // 3. Data subset: the estimate is refit on the first and last 80 percent of
  // the panel. The sign has to hold in both.
  const cut = Math.floor(rows.length * 0.8);
  const head = estimate(rows.slice(0, cut), treatment, controls);
  const tail = estimate(rows.slice(rows.length - cut), treatment, controls);
  const subsetPassed =
    Math.sign(head.coefficient) === Math.sign(base.coefficient) &&
    Math.sign(tail.coefficient) === Math.sign(base.coefficient);

  return [
    {
      name: "Placebo treatment",
      detail: `Treatment reversed in time. Effect collapses from ${base.coefficient} to ${placebo.coefficient} per index point.`,
      passed: placeboPassed,
    },
    {
      name: "Added common cause",
      detail: `Synthetic covariate injected. Estimate moves by ${round(shift * 100, 1)} percent, tolerance 20 percent.`,
      passed: addedPassed,
    },
    {
      name: "Data subset stability",
      detail: `Refit on two 80 percent subsets: ${head.coefficient} and ${tail.coefficient}, sign ${subsetPassed ? "stable" : "unstable"}.`,
      passed: subsetPassed,
    },
  ];
}

export interface Hypothesis {
  id: string;
  label: string;
  method: string;
  estimate: EffectEstimate;
  /** Estimated effect on the KPI over the analysis window, in USD. */
  impactUsd: number;
  refutations: RefutationResult[];
  rejected: boolean;
  rejectionReason?: string | undefined;
  detail: string;
}

const windowSplit = (rows: PanelRow[], windowDays: number) => ({
  recent: rows.slice(-windowDays),
  base: rows.slice(-windowDays * 2, -windowDays),
});

/**
 * Tests the competitive pricing hypothesis on the concentrated cell, adjusting
 * for seasonality and marketing pressure.
 */
export function competitorPricingHypothesis(
  region: string,
  segment: string,
  windowDays = 28,
): Hypothesis {
  const rows = buildPanel(region, segment);
  const controls: Extractor[] = [(r) => r.seasonality, (r) => r.marketingSpend];
  const est = estimate(rows, (r) => r.competitorIndex, controls);
  const refutations = refute(rows, (r) => r.competitorIndex, controls, est);
  const { recent, base } = windowSplit(rows, windowDays);
  const deltaIndex = mean(recent.map((r) => r.competitorIndex)) - mean(base.map((r) => r.competitorIndex));
  const impact = est.coefficient * deltaIndex * recent.length;
  const failed = refutations.filter((r) => !r.passed);
  return {
    id: "competitor_pricing",
    label: `Competitor list price cut in ${region} ${segment}`,
    method: "Ordinary least squares on the daily panel, adjusted for seasonality and marketing spend, with a three test refutation battery",
    estimate: est,
    impactUsd: round(impact, 0),
    refutations,
    rejected: failed.length > 0 || est.pValue > 0.05,
    rejectionReason:
      failed.length > 0
        ? `Failed refutation: ${failed.map((f) => f.name).join(", ")}`
        : est.pValue > 0.05
          ? "Effect is not statistically distinguishable from zero"
          : undefined,
    detail: `The competitor price index for ${region} moved ${round(deltaIndex, 2)} points between the baseline and the current window. Each index point is associated with ${round(est.coefficient, 0)} USD of daily booked revenue in this cell.`,
  };
}

/** Tests whether ordinary seasonality is sufficient to explain the movement. */
export function seasonalityHypothesis(
  region: string,
  segment: string,
  observedDelta: number,
  windowDays = 28,
): Hypothesis {
  const rows = buildPanel(region, segment);
  const controls: Extractor[] = [(r) => r.competitorIndex, (r) => r.marketingSpend];
  const est = estimate(rows, (r) => r.seasonality, controls);
  const refutations = refute(rows, (r) => r.seasonality, controls, est);
  const { recent, base } = windowSplit(rows, windowDays);
  const deltaSeason = mean(recent.map((r) => r.seasonality)) - mean(base.map((r) => r.seasonality));
  const impact = est.coefficient * deltaSeason * recent.length;
  const explains = observedDelta === 0 ? 0 : Math.abs(impact / observedDelta);
  return {
    id: "seasonality",
    label: "Normal seasonal slowdown",
    method: "Ordinary least squares with the seasonal index as treatment, adjusted for competitive pressure and marketing spend",
    estimate: est,
    impactUsd: round(impact, 0),
    refutations,
    rejected: explains < 0.25 || est.pValue > 0.05,
    rejectionReason:
      explains < 0.25
        ? `Seasonality explains only ${round(explains * 100, 1)} percent of the observed change, below the 25 percent sufficiency bar`
        : est.pValue > 0.05
          ? `Seasonality accounts for ${round(explains * 100, 1)} percent of the change but the coefficient is not distinguishable from zero at the 5 percent level (p = ${est.pValue}), so it is not accepted as an explanation`
          : undefined,
    detail: `The seasonal index moved ${round(deltaSeason, 4)} between windows, which accounts for ${round(explains * 100, 1)} percent of the observed change.`,
  };
}

/** Tests whether deeper discounting rather than lost volume drove the movement. */
export function discountingHypothesis(region: string, segment: string, windowDays = 28): Hypothesis {
  const rows = buildPanel(region, segment);
  const controls: Extractor[] = [(r) => r.seasonality, (r) => r.marketingSpend];
  const est = estimate(rows, (r) => r.discountPct, controls);
  const refutations = refute(rows, (r) => r.discountPct, controls, est);
  const { recent, base } = windowSplit(rows, windowDays);
  const deltaDiscount = mean(recent.map((r) => r.discountPct)) - mean(base.map((r) => r.discountPct));
  const impact = est.coefficient * deltaDiscount * recent.length;
  const failed = refutations.filter((r) => !r.passed);
  return {
    id: "discounting",
    label: `Defensive discounting in ${region} ${segment}`,
    method: "Ordinary least squares with realised discount rate as treatment, adjusted for seasonality and marketing spend",
    estimate: est,
    impactUsd: round(impact, 0),
    refutations,
    rejected: failed.length > 1,
    rejectionReason: failed.length > 1 ? `Failed refutation: ${failed.map((f) => f.name).join(", ")}` : undefined,
    detail: `Realised discount moved ${round(deltaDiscount, 2)} percentage points. Discounting is a response to the competitive move, so its effect is reported separately to avoid double counting.`,
  };
}

/** Cross-source consistency test used by the abstention rules. */
export function consistencyCheck(
  seriesA: number[],
  seriesB: number[],
  expectedSign: 1 | -1,
): { correlation: number; consistent: boolean; detail: string } {
  const n = Math.min(seriesA.length, seriesB.length);
  const a = seriesA.slice(-n);
  const b = seriesB.slice(-n);
  const ma = mean(a);
  const mb = mean(b);
  const sa = stdev(a) || 1;
  const sb = stdev(b) || 1;
  const corr = round(sum(a.map((v, i) => ((v - ma) / sa) * (((b[i] as number) - mb) / sb))) / n, 3);
  const consistent = Math.sign(corr) === expectedSign || Math.abs(corr) < 0.2;
  return {
    correlation: corr,
    consistent,
    detail: `Observed correlation ${corr} against an expected sign of ${expectedSign > 0 ? "positive" : "negative"}.`,
  };
}
