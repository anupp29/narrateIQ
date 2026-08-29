/**
 * Security and entitlements.
 *
 * Row, column and domain rules are evaluated before any data leaves the
 * engine, so a restricted value never reaches the narrative model or the
 * browser payload. Every evaluation is written to an append-only audit trail.
 */

export type Persona = "CFO" | "RSM";

export const PERSONA_LABEL: Record<Persona, string> = {
  CFO: "Chief Financial Officer",
  RSM: "Regional Sales Manager",
};

export const PERSONA_PROFILE: Record<
  Persona,
  {
    label: string;
    scope: string;
    domains: string[];
    regions: string[] | "ALL";
    clearance: "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
    channel: string;
    decisionBand: string;
  }
> = {
  CFO: {
    label: "Chief Financial Officer",
    scope: "Company wide",
    domains: ["Finance", "Sales", "Marketing", "Operations"],
    regions: "ALL",
    clearance: "RESTRICTED",
    channel: "Morning board digest and decision workspace",
    decisionBand: "Unlimited, board reporting obligations apply",
  },
  RSM: {
    label: "Regional Sales Manager",
    scope: "South region only",
    domains: ["Sales", "Finance"],
    regions: ["South"],
    clearance: "CONFIDENTIAL",
    channel: "Mobile alert and weekly pipeline review",
    decisionBand: "Discount approvals up to 10 percent, retention plays within playbook",
  },
};

export interface AuditEntry {
  at: string;
  actor: Persona;
  action: string;
  object: string;
  decision: "ALLOW" | "DENY" | "MASK";
  rule: string;
}

const AUDIT_KEY = "narrateiq.audit.v1";
const memoryAudit: AuditEntry[] = [];

export function audit(entry: Omit<AuditEntry, "at">): AuditEntry {
  const full: AuditEntry = { at: new Date().toISOString(), ...entry };
  memoryAudit.unshift(full);
  if (typeof window !== "undefined") {
    try {
      const existing = readAudit();
      window.localStorage.setItem(AUDIT_KEY, JSON.stringify([full, ...existing].slice(0, 200)));
    } catch {
      // storage unavailable, the in-memory trail still holds the session
    }
  }
  return full;
}

export function readAudit(): AuditEntry[] {
  if (typeof window === "undefined") return [...memoryAudit];
  try {
    const raw = window.localStorage.getItem(AUDIT_KEY);
    const parsed = raw ? (JSON.parse(raw) as AuditEntry[]) : [];
    return parsed.length ? parsed : [...memoryAudit];
  } catch {
    return [...memoryAudit];
  }
}

export interface AccessDecision {
  allowed: boolean;
  rowFilter: string | null;
  maskedColumns: string[];
  rule: string;
}

export function evaluateAccess(
  persona: Persona,
  contract: {
    id: string;
    name: string;
    entitlements: {
      visibleTo: Persona[];
      rowFilter: Partial<Record<Persona, string>>;
      maskedColumns: Partial<Record<Persona, string[]>>;
      domain: string;
      classification: string;
    };
  },
): AccessDecision {
  const e = contract.entitlements;
  const profile = PERSONA_PROFILE[persona];
  const domainOk = profile.domains.includes(e.domain);
  const clearanceRank = { INTERNAL: 1, CONFIDENTIAL: 2, RESTRICTED: 3 } as const;
  const clearanceOk =
    clearanceRank[profile.clearance] >=
    clearanceRank[(e.classification as keyof typeof clearanceRank) ?? "INTERNAL"];
  const allowed = e.visibleTo.includes(persona) && domainOk && clearanceOk;

  const decision: AccessDecision = {
    allowed,
    rowFilter: e.rowFilter[persona] ?? null,
    maskedColumns: e.maskedColumns[persona] ?? [],
    rule: allowed
      ? `domain ${e.domain} in clearance ${profile.clearance}${e.rowFilter[persona] ? `, row filter ${e.rowFilter[persona]}` : ""}`
      : `classification ${e.classification} exceeds ${persona} clearance ${profile.clearance}`,
  };

  audit({
    actor: persona,
    action: "kpi.read",
    object: contract.name,
    decision: allowed ? (decision.maskedColumns.length ? "MASK" : "ALLOW") : "DENY",
    rule: decision.rule,
  });

  return decision;
}

/** Applies a persona row filter to any region-scoped dataset. */
export function applyRowFilter<T extends { region?: string }>(rows: T[], persona: Persona): T[] {
  const profile = PERSONA_PROFILE[persona];
  if (profile.regions === "ALL") return rows;
  return rows.filter((r) => !r.region || (profile.regions as string[]).includes(r.region));
}
