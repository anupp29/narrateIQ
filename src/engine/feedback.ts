/**
 * Human feedback and the learning loop.
 *
 * Corrections are persisted, then replayed as priors on the next run. A
 * confirmed driver gains confidence, a rejected driver loses it, and a
 * suppressed driver is demoted below the fold. The loop is deterministic and
 * fully auditable, so a business user can see exactly why a later brief
 * differs from an earlier one.
 */

export type FeedbackVerdict = "CONFIRMED" | "REJECTED" | "CORRECTED";

export interface FeedbackRecord {
  id: string;
  at: string;
  kpiId: string;
  driverId: string | null;
  persona: string;
  verdict: FeedbackVerdict;
  comment: string;
  author: string;
}

export interface DriverPrior {
  driverId: string;
  confirmations: number;
  rejections: number;
  /** Additive adjustment applied to the model confidence score, bounded. */
  adjustment: number;
  lastComment: string | null;
}

const KEY = "narrateiq.feedback.v1";

/** Seed corrections, standing in for the corrections an analyst team already made. */
const SEED: FeedbackRecord[] = [
  {
    id: "F-0001",
    at: "2026-08-18T10:12:00Z",
    kpiId: "revenue",
    driverId: "invoice_timing",
    persona: "CFO",
    verdict: "CORRECTED",
    comment:
      "Billing migration effects should be attributed to the week the invoice is issued, not the week the order is placed.",
    author: "Analytics Lead",
  },
  {
    id: "F-0002",
    at: "2026-08-21T15:40:00Z",
    kpiId: "revenue",
    driverId: "competitor_pricing",
    persona: "RSM",
    verdict: "CONFIRMED",
    comment: "Matches what the South team reported in the pipeline review.",
    author: "Regional Sales Manager",
  },
  {
    id: "F-0003",
    at: "2026-08-24T09:05:00Z",
    kpiId: "revenue",
    driverId: "seasonality",
    persona: "CFO",
    verdict: "REJECTED",
    comment: "August seasonality is already in the plan. Stop surfacing it as an explanation.",
    author: "FP&A Manager",
  },
];

export function readFeedback(): FeedbackRecord[] {
  if (typeof window === "undefined") return [...SEED];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [...SEED];
    const parsed = JSON.parse(raw) as FeedbackRecord[];
    return [...SEED, ...parsed];
  } catch {
    return [...SEED];
  }
}

export function recordFeedback(input: Omit<FeedbackRecord, "id" | "at">): FeedbackRecord {
  const record: FeedbackRecord = {
    id: `F-${Date.now().toString().slice(-6)}`,
    at: new Date().toISOString(),
    ...input,
  };
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(KEY);
      const existing = raw ? (JSON.parse(raw) as FeedbackRecord[]) : [];
      window.localStorage.setItem(KEY, JSON.stringify([...existing, record]));
    } catch {
      // non fatal, the record still applies to the current session
    }
  }
  return record;
}

export function clearSessionFeedback(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Collapses the correction history into bounded priors per driver. */
export function priorsFor(kpiId: string): Record<string, DriverPrior> {
  const priors: Record<string, DriverPrior> = {};
  readFeedback()
    .filter((f) => f.kpiId === kpiId && f.driverId)
    .forEach((f) => {
      const id = f.driverId as string;
      const p = priors[id] ?? { driverId: id, confirmations: 0, rejections: 0, adjustment: 0, lastComment: null };
      if (f.verdict === "CONFIRMED") p.confirmations += 1;
      if (f.verdict === "REJECTED") p.rejections += 1;
      p.lastComment = f.comment;
      p.adjustment = Math.max(-0.15, Math.min(0.1, 0.05 * p.confirmations - 0.075 * p.rejections));
      priors[id] = p;
    });
  return priors;
}

export const feedbackCountFor = (kpiId: string): number =>
  readFeedback().filter((f) => f.kpiId === kpiId).length;
