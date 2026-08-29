/**
 * Source-system adapters.
 *
 * Each CSV in src/data/csv stands in for one operational system with its own
 * grain, cadence and quality profile. Parsing is lazy and memoised so nothing
 * heavy runs during module evaluation.
 */

import crmDealsRaw from "@/data/csv/crm_deals_daily.csv?raw";
import marketingRaw from "@/data/csv/marketing_spend_weekly.csv?raw";
import opsRaw from "@/data/csv/ops_returns_weekly.csv?raw";
import npsRaw from "@/data/csv/nps_weekly.csv?raw";
import financeRaw from "@/data/csv/finance_newmarket_monthly.csv?raw";
import signalsRaw from "@/data/csv/market_signals_weekly.csv?raw";
import notesRaw from "@/data/csv/crm_notes.csv?raw";
import { num, parseCsv } from "./csv";

export interface DealRow {
  date: string;
  region: string;
  segment: string;
  dealsTotal: number;
  dealsWon: number;
  units: number;
  avgUnitPrice: number;
  discountPct: number;
  revenueBooked: number;
  invoiceDelayDays: number;
  revenueRecognized: number;
}

export interface MarketingRow {
  weekStart: string;
  channel: string;
  spend: number;
  leads: number;
  newCustomers: number;
}

export interface OpsRow {
  weekStart: string;
  region: string;
  unitsShipped: number;
  unitsReturned: number;
  defectTickets: number;
  policyChangeFlag: number;
}

export interface NpsRow {
  weekStart: string;
  region: string;
  npsScore: number;
  responses: number;
}

export interface FinanceRow {
  month: string;
  market: string;
  revenueLocal: number;
  currency: string;
  fxRateToUsd: number;
}

export interface SignalRow {
  weekStart: string;
  region: string;
  competitorPriceIndex: number;
  seasonalityIndex: number;
}

export interface NoteRow {
  noteId: string;
  date: string;
  source: "CRM" | "Tickets";
  region: string;
  segment: string;
  authorRole: string;
  text: string;
}

function memo<T>(fn: () => T): () => T {
  let value: T | undefined;
  let done = false;
  return () => {
    if (!done) {
      value = fn();
      done = true;
    }
    return value as T;
  };
}

export const deals = memo<DealRow[]>(() =>
  parseCsv(crmDealsRaw).map((r) => ({
    date: r["date"] ?? "",
    region: r["region"] ?? "",
    segment: r["segment"] ?? "",
    dealsTotal: num(r["deals_total"]),
    dealsWon: num(r["deals_won"]),
    units: num(r["units"]),
    avgUnitPrice: num(r["avg_unit_price"]),
    discountPct: num(r["discount_pct"]),
    revenueBooked: num(r["revenue_booked"]),
    invoiceDelayDays: num(r["invoice_delay_days"]),
    revenueRecognized: num(r["revenue_recognized"]),
  })),
);

export const marketing = memo<MarketingRow[]>(() =>
  parseCsv(marketingRaw).map((r) => ({
    weekStart: r["week_start"] ?? "",
    channel: r["channel"] ?? "",
    spend: num(r["spend"]),
    leads: num(r["leads"]),
    newCustomers: num(r["new_customers"]),
  })),
);

export const ops = memo<OpsRow[]>(() =>
  parseCsv(opsRaw).map((r) => ({
    weekStart: r["week_start"] ?? "",
    region: r["region"] ?? "",
    unitsShipped: num(r["units_shipped"]),
    unitsReturned: num(r["units_returned"]),
    defectTickets: num(r["defect_tickets"]),
    policyChangeFlag: num(r["policy_change_flag"]),
  })),
);

export const nps = memo<NpsRow[]>(() =>
  parseCsv(npsRaw).map((r) => ({
    weekStart: r["week_start"] ?? "",
    region: r["region"] ?? "",
    npsScore: num(r["nps_score"]),
    responses: num(r["responses"]),
  })),
);

export const finance = memo<FinanceRow[]>(() =>
  parseCsv(financeRaw).map((r) => ({
    month: r["month"] ?? "",
    market: r["market"] ?? "",
    revenueLocal: num(r["revenue_local"]),
    currency: r["currency"] ?? "USD",
    fxRateToUsd: num(r["fx_rate_to_usd"]) || 1,
  })),
);

export const signals = memo<SignalRow[]>(() =>
  parseCsv(signalsRaw).map((r) => ({
    weekStart: r["week_start"] ?? "",
    region: r["region"] ?? "",
    competitorPriceIndex: num(r["competitor_price_index"]),
    seasonalityIndex: num(r["seasonality_index"]),
  })),
);

export const notes = memo<NoteRow[]>(() =>
  parseCsv(notesRaw).map((r) => ({
    noteId: r["note_id"] ?? "",
    date: r["date"] ?? "",
    source: (r["source"] as "CRM" | "Tickets") ?? "CRM",
    region: r["region"] ?? "",
    segment: r["segment"] ?? "",
    authorRole: r["author_role"] ?? "",
    text: r["text"] ?? "",
  })),
);

/** The demo clock. Every freshness and window calculation is relative to this. */
export const AS_OF = "2026-08-29";

export const rowCounts = () => ({
  crm_deals_daily: deals().length,
  marketing_spend_weekly: marketing().length,
  ops_returns_weekly: ops().length,
  nps_weekly: nps().length,
  finance_newmarket_monthly: finance().length,
  market_signals_weekly: signals().length,
  crm_notes: notes().length,
});

export const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (a: string, b: string): number =>
  Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000,
  );

/** ISO week start (Monday) for any date, used to align daily data to weekly grains. */
export const weekStart = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
};
