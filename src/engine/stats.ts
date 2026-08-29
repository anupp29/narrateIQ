/**
 * Deterministic statistics layer.
 *
 * Everything in this file is closed form and reproducible. No sampling, no
 * randomness, no model calls. The narrative layer is never allowed to compute
 * any of these values.
 */

export const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** Median absolute deviation, scaled to be a consistent estimator of sigma. */
export function mad(xs: number[]): number {
  const m = median(xs);
  return 1.4826 * median(xs.map((x) => Math.abs(x - m)));
}

/** Outlier-resistant z-score. Falls back to the classical z when MAD collapses. */
export function robustZ(value: number, baseline: number[]): number {
  const scale = mad(baseline) || stdev(baseline);
  if (!scale) return 0;
  return (value - median(baseline)) / scale;
}

export function centeredMovingAverage(xs: number[], window: number): (number | null)[] {
  const half = Math.floor(window / 2);
  return xs.map((_, i) => {
    if (i < half || i >= xs.length - half) return null;
    return mean(xs.slice(i - half, i + half + 1));
  });
}

export interface Decomposition {
  trend: (number | null)[];
  seasonal: number[];
  remainder: number[];
  seasonalStrength: number;
  period: number;
}

/**
 * Classical seasonal-trend decomposition (additive).
 * Trend: centered moving average over one full period.
 * Seasonal: mean detrended value per phase, re-centered to zero.
 * Remainder: the residual the anomaly detector actually scores.
 */
export function decompose(series: number[], period: number): Decomposition {
  const trend = centeredMovingAverage(series, period % 2 === 0 ? period + 1 : period);
  const detrended = series.map((v, i) => {
    const t = trend[i];
    return t === null || t === undefined ? null : v - t;
  });

  const phaseSums = new Array<number>(period).fill(0);
  const phaseCounts = new Array<number>(period).fill(0);
  detrended.forEach((v, i) => {
    if (v === null) return;
    const p = i % period;
    phaseSums[p] = (phaseSums[p] as number) + v;
    phaseCounts[p] = (phaseCounts[p] as number) + 1;
  });
  const rawSeasonal = phaseSums.map((s, i) => ((phaseCounts[i] as number) ? s / (phaseCounts[i] as number) : 0));
  const centre = mean(rawSeasonal);
  const seasonalPhase = rawSeasonal.map((s) => s - centre);
  const seasonal = series.map((_, i) => seasonalPhase[i % period] as number);

  const remainder = series.map((v, i) => {
    const t = trend[i];
    return t === null || t === undefined ? 0 : v - t - (seasonal[i] as number);
  });

  const inWindow = series.map((_, i) => trend[i] !== null && trend[i] !== undefined);
  const varRemainder = stdev(remainder.filter((_, i) => inWindow[i])) ** 2;
  const varDetrended =
    stdev(
      detrended.filter((v): v is number => v !== null),
    ) ** 2;
  const seasonalStrength = varDetrended === 0 ? 0 : Math.max(0, 1 - varRemainder / varDetrended);

  return { trend, seasonal, remainder, seasonalStrength, period };
}

export interface CusumResult {
  triggered: boolean;
  changePointIndex: number | null;
  peak: number;
  threshold: number;
}

/**
 * Two-sided CUSUM on standardised residuals.
 * k is the slack (in sigmas) and h the decision interval.
 */
export function cusum(residuals: number[], k = 0.5, h = 4): CusumResult {
  const sd = stdev(residuals) || 1;
  let pos = 0;
  let neg = 0;
  let peak = 0;
  let changePointIndex: number | null = null;

  residuals.forEach((r, i) => {
    const z = r / sd;
    pos = Math.max(0, pos + z - k);
    neg = Math.max(0, neg - z - k);
    const local = Math.max(pos, neg);
    if (local > peak) peak = local;
    if (changePointIndex === null && local > h) changePointIndex = i;
  });

  return { triggered: peak > h, changePointIndex, peak: round(peak, 2), threshold: h };
}

export interface Ols {
  coefficients: number[];
  stdErrors: number[];
  tStats: number[];
  r2: number;
  n: number;
}

/** Ordinary least squares via Gaussian elimination on the normal equations. */
export function ols(X: number[][], y: number[]): Ols {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  const design = X.map((row) => [1, ...row]);
  const k = p + 1;

  const xtx: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const xty: number[] = new Array<number>(k).fill(0);
  for (let i = 0; i < n; i++) {
    const row = design[i] as number[];
    const yi = y[i] as number;
    for (let a = 0; a < k; a++) {
      xty[a] = (xty[a] as number) + (row[a] as number) * yi;
      const xa = xtx[a] as number[];
      for (let b = 0; b < k; b++) xa[b] = (xa[b] as number) + (row[a] as number) * (row[b] as number);
    }
  }

  const inv = invert(xtx);
  const beta = inv.map((row) => row.reduce((acc, v, j) => acc + v * (xty[j] as number), 0));

  const fitted = design.map((row) => row.reduce((acc, v, j) => acc + v * (beta[j] as number), 0));
  const resid = y.map((v, i) => v - (fitted[i] as number));
  const dof = Math.max(1, n - k);
  const sigma2 = sum(resid.map((r) => r * r)) / dof;
  const stdErrors = inv.map((row, i) => Math.sqrt(Math.max(sigma2 * (row[i] as number), 0)));
  const yMean = mean(y);
  const ssTot = sum(y.map((v) => (v - yMean) ** 2)) || 1;
  const r2 = 1 - sum(resid.map((r) => r * r)) / ssTot;

  return {
    coefficients: beta,
    stdErrors,
    tStats: beta.map((b, i) => ((stdErrors[i] as number) ? b / (stdErrors[i] as number) : 0)),
    r2,
    n,
  };
}

function invert(m: number[][]): number[][] {
  const k = m.length;
  const a = m.map((row, i) => [...row, ...identityRow(k, i)]);
  for (let col = 0; col < k; col++) {
    let pivot = col;
    for (let r = col; r < k; r++) {
      if (Math.abs((a[r] as number[])[col] as number) > Math.abs((a[pivot] as number[])[col] as number)) pivot = r;
    }
    const pivotRow = a[pivot] as number[];
    if (Math.abs(pivotRow[col] as number) < 1e-12) continue;
    a[pivot] = a[col] as number[];
    a[col] = pivotRow;
    const cur = a[col] as number[];
    const d = cur[col] as number;
    for (let c = 0; c < 2 * k; c++) cur[c] = (cur[c] as number) / d;
    for (let r = 0; r < k; r++) {
      if (r === col) continue;
      const row = a[r] as number[];
      const f = row[col] as number;
      if (!f) continue;
      for (let c = 0; c < 2 * k; c++) row[c] = (row[c] as number) - f * (cur[c] as number);
    }
  }
  return a.map((row) => row.slice(k));
}

const identityRow = (k: number, i: number) => Array.from({ length: k }, (_, j) => (j === i ? 1 : 0));

export function pearson(a: number[], b: number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  const cov = sum(a.map((v, i) => (v - ma) * ((b[i] as number) - mb)));
  const den = Math.sqrt(sum(a.map((v) => (v - ma) ** 2)) * sum(b.map((v) => (v - mb) ** 2)));
  return den === 0 ? 0 : cov / den;
}

export interface Forecast {
  point: number[];
  lower: number[];
  upper: number[];
  residualSigma: number;
}

/** Holt linear trend forecast with a normal-approximation prediction interval. */
export function holtForecast(series: number[], horizon: number, alpha = 0.4, beta = 0.15): Forecast {
  if (series.length < 3) {
    return { point: new Array<number>(horizon).fill(series.at(-1) ?? 0), lower: [], upper: [], residualSigma: 0 };
  }
  let level = series[0] as number;
  let trend = (series[1] as number) - (series[0] as number);
  const oneStep: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const actual = series[i] as number;
    oneStep.push(actual - (level + trend));
    const prevLevel = level;
    level = alpha * actual + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const sigma = stdev(oneStep);
  const point: number[] = [];
  const lower: number[] = [];
  const upper: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const p = level + h * trend;
    const widen = sigma * Math.sqrt(h);
    point.push(p);
    lower.push(p - 1.96 * widen);
    upper.push(p + 1.96 * widen);
  }
  return { point, lower, upper, residualSigma: sigma };
}

/** Population stability index, used for the data and model drift monitor. */
export function psi(expected: number[], actual: number[], buckets = 10): number {
  if (expected.length === 0 || actual.length === 0) return 0;
  const sorted = [...expected].sort((a, b) => a - b);
  const cuts = Array.from(
    { length: buckets - 1 },
    (_, i) => sorted[Math.floor(((i + 1) / buckets) * sorted.length)] as number,
  );
  const bucketise = (xs: number[]) => {
    const counts = new Array<number>(buckets).fill(0);
    xs.forEach((x) => {
      let b = 0;
      while (b < cuts.length && x > (cuts[b] as number)) b++;
      counts[b] = (counts[b] as number) + 1;
    });
    return counts.map((c) => Math.max(c / xs.length, 1e-6));
  };
  const e = bucketise(expected);
  const a = bucketise(actual);
  return sum(e.map((ev, i) => ((a[i] as number) - ev) * Math.log((a[i] as number) / ev)));
}

export const round = (v: number, dp = 2): number => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const prob =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - prob : prob;
}

/** Two-sided p-value for a t statistic, normal approximation. */
export function pValue(t: number): number {
  return Math.max(2 * (1 - normalCdf(Math.abs(t))), 1e-6);
}
