/**
 * Model and data health.
 *
 * Detection quality is measured against the analyst verdicts captured in the
 * feedback loop, and input stability is measured with the population
 * stability index. Both are computed, not asserted.
 */

import { dailyRevenue, weeklyCac, weeklyReturnRate } from "./metrics";
import { readFeedback } from "./feedback";
import { psi, round } from "./stats";
import { AS_OF } from "./datasets";

export interface DriftRow {
  input: string;
  psi: number;
  status: "stable" | "watch" | "shifted";
  interpretation: string;
}

const status = (v: number): DriftRow["status"] => (v < 0.1 ? "stable" : v < 0.25 ? "watch" : "shifted");

export function driftReport(): DriftRow[] {
  const rev = dailyRevenue("CFO").map((p) => p.value);
  const ret = weeklyReturnRate("CFO").map((p) => p.value);
  const cac = weeklyCac().map((p) => p.value);

  const rows: { input: string; expected: number[]; actual: number[] }[] = [
    { input: "Daily recognised revenue", expected: rev.slice(0, -28), actual: rev.slice(-28) },
    { input: "Weekly return rate", expected: ret.slice(0, -4), actual: ret.slice(-4) },
    { input: "Weekly cost per acquisition", expected: cac.slice(0, -4), actual: cac.slice(-4) },
  ];

  return rows.map((r) => {
    const value = round(psi(r.expected, r.actual), 3);
    const s = status(value);
    return {
      input: r.input,
      psi: value,
      status: s,
      interpretation:
        s === "stable"
          ? "Input distribution is consistent with the training baseline."
          : s === "watch"
            ? "Moderate shift. Thresholds are still valid but the baseline should be refreshed at the next review."
            : "Material shift. The baseline window must be refreshed before these thresholds are trusted.",
    };
  });
}

export interface DetectionQuality {
  alertsRaised: number;
  analystConfirmed: number;
  analystRejected: number;
  precision: number | null;
  suppressedDrivers: string[];
  baselineWindow: string;
  lastRecalibration: string;
  note: string;
}

export function detectionQuality(): DetectionQuality {
  const feedback = readFeedback();
  const confirmed = feedback.filter((f) => f.verdict === "CONFIRMED").length;
  const rejected = feedback.filter((f) => f.verdict === "REJECTED").length;
  const corrected = feedback.filter((f) => f.verdict === "CORRECTED").length;
  const judged = confirmed + rejected;
  return {
    alertsRaised: feedback.length,
    analystConfirmed: confirmed,
    analystRejected: rejected,
    precision: judged === 0 ? null : round(confirmed / judged, 2),
    suppressedDrivers: feedback.filter((f) => f.verdict === "REJECTED" && f.driverId).map((f) => f.driverId as string),
    baselineWindow: `Rolling 112 days ending ${AS_OF}`,
    lastRecalibration: "2026-08-03",
    note: `${corrected} correction${corrected === 1 ? "" : "s"} from analysts are replayed as priors on every run. Precision is computed only over judged alerts, so it is reported as unavailable until analysts have judged at least one.`,
  };
}
