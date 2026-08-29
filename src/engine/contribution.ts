/**
 * Dimensional drill-down and arithmetic contribution analysis.
 *
 * This layer answers "where did the movement come from" using exact
 * accounting decomposition, before any causal claim is made. Volume, price
 * and mix effects sum back to the observed change, so the brief can never
 * present contributions that do not reconcile.
 */

import { applyRowFilter, type Persona } from "./rbac";
import { deals } from "./datasets";
import { round, sum } from "./stats";

export interface CellContribution {
  region: string;
  segment: string;
  recent: number;
  baseline: number;
  delta: number;
  shareOfDelta: number;
  volumeEffect: number;
  priceEffect: number;
  interactionEffect: number;
}

export interface RevenueDecomposition {
  recent: number;
  baseline: number;
  delta: number;
  cells: CellContribution[];
  totals: { volume: number; price: number; interaction: number; timing: number; residual: number };
  concentration: { label: string; shareOfDelta: number } | null;
  windowDays: number;
}

const key = (r: string, s: string) => `${r}|${s}`;

/**
 * Compares the trailing window with the immediately preceding window of the
 * same length, cell by cell, then splits each cell delta into volume, price
 * and interaction components.
 */
export function decomposeRevenue(persona: Persona, windowDays = 28): RevenueDecomposition {
  const rows = applyRowFilter(deals(), persona);
  const dates = Array.from(new Set(rows.map((r) => r.date))).sort();
  const recentDates = new Set(dates.slice(-windowDays));
  const baseDates = new Set(dates.slice(-windowDays * 2, -windowDays));

  const agg = new Map<
    string,
    { region: string; segment: string; recentRev: number; recentWon: number; baseRev: number; baseWon: number }
  >();

  rows.forEach((r) => {
    const inRecent = recentDates.has(r.date);
    const inBase = baseDates.has(r.date);
    if (!inRecent && !inBase) return;
    const k = key(r.region, r.segment);
    const a =
      agg.get(k) ?? { region: r.region, segment: r.segment, recentRev: 0, recentWon: 0, baseRev: 0, baseWon: 0 };
    if (inRecent) {
      a.recentRev += r.revenueBooked;
      a.recentWon += r.dealsWon;
    } else {
      a.baseRev += r.revenueBooked;
      a.baseWon += r.dealsWon;
    }
    agg.set(k, a);
  });

  const cells: CellContribution[] = Array.from(agg.values()).map((a) => {
    const p1 = a.recentWon === 0 ? 0 : a.recentRev / a.recentWon;
    const p0 = a.baseWon === 0 ? 0 : a.baseRev / a.baseWon;
    const dq = a.recentWon - a.baseWon;
    const dp = p1 - p0;
    return {
      region: a.region,
      segment: a.segment,
      recent: round(a.recentRev, 0),
      baseline: round(a.baseRev, 0),
      delta: round(a.recentRev - a.baseRev, 0),
      shareOfDelta: 0,
      volumeEffect: round(dq * p0, 0),
      priceEffect: round(a.baseWon * dp, 0),
      interactionEffect: round(dq * dp, 0),
    };
  });

  const totalDelta = sum(cells.map((c) => c.delta));
  cells.forEach((c) => {
    c.shareOfDelta = totalDelta === 0 ? 0 : round((c.delta / totalDelta) * 100, 1);
  });
  cells.sort((a, b) => a.delta - b.delta);

  // Timing: booked revenue that has not yet been recognised because the
  // billing migration pushed the invoice issue date beyond the window.
  const recentRows = rows.filter((r) => recentDates.has(r.date));
  const baseRows = rows.filter((r) => baseDates.has(r.date));
  const gap = (set: typeof rows) => sum(set.map((r) => r.revenueBooked - r.revenueRecognized));
  const timing = -(gap(recentRows) - gap(baseRows));

  const recognisedRecent = sum(recentRows.map((r) => r.revenueRecognized));
  const recognisedBase = sum(baseRows.map((r) => r.revenueRecognized));
  const recognisedDelta = recognisedRecent - recognisedBase;

  const volume = sum(cells.map((c) => c.volumeEffect));
  const price = sum(cells.map((c) => c.priceEffect));
  const interaction = sum(cells.map((c) => c.interactionEffect));
  const residual = recognisedDelta - (volume + price + interaction + timing);

  const worst = cells[0];
  return {
    recent: round(recognisedRecent, 0),
    baseline: round(recognisedBase, 0),
    delta: round(recognisedDelta, 0),
    cells,
    totals: {
      volume: round(volume, 0),
      price: round(price, 0),
      interaction: round(interaction, 0),
      timing: round(timing, 0),
      residual: round(residual, 0),
    },
    concentration:
      worst && totalDelta !== 0
        ? { label: `${worst.region} ${worst.segment}`, shareOfDelta: round((worst.delta / totalDelta) * 100, 1) }
        : null,
    windowDays,
  };
}
