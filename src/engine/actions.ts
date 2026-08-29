/**
 * Action layer.
 *
 * A validated driver is mapped to a decision through a governed playbook:
 * a lever, an owner, a deadline, the decision rights that apply to the
 * persona reading the brief, and a monitoring plan that says how the outcome
 * will be measured. Expected impact is derived from the estimated driver
 * contribution and a documented recovery assumption, never invented.
 */

import { AS_OF, addDays } from "./datasets";
import type { Persona } from "./rbac";
import { round } from "./stats";
import type { ActionRec, Confidence, DriverFinding } from "./types";

interface PlaybookEntry {
  lever: string;
  action: string;
  /** Share of the driver contribution the play is expected to recover. */
  recovery: number;
  recoveryBasis: string;
  owner: string;
  leadDays: number;
  decisionRights: Record<Persona, string>;
  visibleTo: Persona[];
  constraint: string;
  monitoring: { metric: string; source: string; frequency: string; threshold: string; owner: string; reviewDays: number };
}

const PLAYBOOK: Record<string, PlaybookEntry> = {
  competitor_pricing: {
    lever: "Pricing and offer construction",
    action:
      "Activate the approved competitive response bundle for South SMB renewals: a 12 month commitment at the 8 percent floor discount, with the incumbent switching credit applied to the affected cohort only.",
    recovery: 0.55,
    recoveryBasis:
      "Recovery assumption of 55 percent taken from the two previous competitive responses in this segment, held in the pricing playbook.",
    owner: "Regional Sales Manager, South",
    leadDays: 7,
    decisionRights: {
      CFO: "Approves the discount floor and the credit budget.",
      RSM: "Executes within the approved 10 percent discount authority. Anything deeper needs Finance sign-off.",
    },
    visibleTo: ["CFO", "RSM"],
    constraint: "Cohort limited to renewals with a competitor mention on the opportunity record.",
    monitoring: {
      metric: "South SMB win rate and realised discount",
      source: "CRM deal ledger, daily",
      frequency: "Weekly",
      threshold: "Win rate recovers to at least 30 percent within three weeks, realised discount stays under 10 percent",
      owner: "Regional Sales Manager, South",
      reviewDays: 14,
    },
  },
  invoice_timing: {
    lever: "Billing operations",
    action:
      "Clear the invoice backlog created by the billing platform migration and confirm the revenue recognition cut-off with the controller before the month end close.",
    recovery: 0.9,
    recoveryBasis:
      "Timing effects reverse once invoices are issued. Ninety percent is assumed to land inside the next period, the remainder slips a further month.",
    owner: "Group Controller",
    leadDays: 5,
    decisionRights: {
      CFO: "Owns the recognition cut-off decision and the disclosure to the board.",
      RSM: "No decision rights. The regional team is informed, not accountable.",
    },
    visibleTo: ["CFO"],
    constraint: "Cut-off change must be documented for audit before it is applied.",
    monitoring: {
      metric: "Gap between booked and recognised revenue",
      source: "CRM deal ledger reconciled to the finance ledger",
      frequency: "Daily until closed",
      threshold: "Gap returns below 2 percent of booked revenue within five working days",
      owner: "Group Controller",
      reviewDays: 5,
    },
  },
  discounting: {
    lever: "Deal desk control",
    action:
      "Cap ad hoc discounting in South SMB at the approved floor and route every exception through the deal desk with a written competitive justification.",
    recovery: 0.4,
    recoveryBasis:
      "Forty percent recovery assumption, reflecting that part of the discounting is a necessary response to the competitive move.",
    owner: "Deal Desk Lead",
    leadDays: 10,
    decisionRights: {
      CFO: "Sets the discount policy.",
      RSM: "Raises exceptions with justification.",
    },
    visibleTo: ["CFO", "RSM"],
    constraint: "Must not be applied to deals already in legal review.",
    monitoring: {
      metric: "Realised discount rate in South SMB",
      source: "CRM deal ledger, daily",
      frequency: "Weekly",
      threshold: "Realised discount returns to within 1 percentage point of the group average within four weeks",
      owner: "Deal Desk Lead",
      reviewDays: 21,
    },
  },
  returns_policy: {
    lever: "Returns policy and fulfilment quality",
    action:
      "Confirm with the operations lead whether the returns window was changed in the last two weeks, then reconcile the policy register before any corrective action is taken.",
    recovery: 0.0,
    recoveryBasis: "No recovery is claimed. This is an investigation step, not a corrective action.",
    owner: "Operations Lead",
    leadDays: 3,
    decisionRights: {
      CFO: "Requests the reconciliation and sets the reporting deadline.",
      RSM: "Not in scope.",
    },
    visibleTo: ["CFO"],
    constraint: "No customer facing change until the policy question is answered.",
    monitoring: {
      metric: "Weekly return rate and net promoter score, read together",
      source: "Operations returns and voice of customer, weekly",
      frequency: "Weekly",
      threshold: "Return rate falls back under 6.5 percent or a policy change is confirmed as the cause",
      owner: "Operations Lead",
      reviewDays: 7,
    },
  },
};

const confidenceFor = (driver: DriverFinding): Confidence => driver.confidence;

/**
 * Builds the ranked action list for a set of validated drivers. Actions the
 * persona cannot see are removed and counted, so the brief can state that
 * something was withheld rather than silently truncating the list.
 */
export function buildActions(
  drivers: DriverFinding[],
  persona: Persona,
): { actions: ActionRec[]; restricted: number } {
  const validated = drivers.filter((d) => !d.rejected);
  const all: ActionRec[] = validated
    .map((d) => {
      const play = PLAYBOOK[d.id];
      if (!play) return null;
      const expected = Math.abs(d.contributionUsd) * play.recovery;
      return {
        rank: 0,
        driverId: d.id,
        driver: d.label,
        lever: play.lever,
        action: play.action,
        expectedImpactUsd: round(expected, 0),
        expectedImpact: `${expected >= 1000 ? `$${Math.round(expected / 1000)}K` : `$${Math.round(expected)}`} over the next period. ${play.recoveryBasis}`,
        owner: play.owner,
        deadline: addDays(AS_OF, play.leadDays),
        confidence: confidenceFor(d),
        decisionRights: play.decisionRights[persona],
        visibleTo: play.visibleTo,
        constraint: play.constraint,
        monitoring: {
          metric: play.monitoring.metric,
          source: play.monitoring.source,
          frequency: play.monitoring.frequency,
          threshold: play.monitoring.threshold,
          owner: play.monitoring.owner,
          firstReview: addDays(AS_OF, play.monitoring.reviewDays),
        },
      } satisfies ActionRec;
    })
    .filter((a): a is ActionRec => a !== null)
    .sort((a, b) => b.expectedImpactUsd - a.expectedImpactUsd);

  const visible = all.filter((a) => a.visibleTo.includes(persona));
  visible.forEach((a, i) => {
    a.rank = i + 1;
  });
  return { actions: visible, restricted: all.length - visible.length };
}
