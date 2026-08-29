import type { Persona } from "./rbac";

export interface Scenario {
  id: "A" | "B" | "C" | "D";
  label: string;
  persona: Persona;
  kpiId: string;
  description: string;
  proves: string;
}

export const SCENARIOS: Record<Scenario["id"], Scenario> = {
  A: {
    id: "A",
    label: "Revenue anomaly, CFO",
    persona: "CFO",
    kpiId: "revenue",
    description: "Material revenue decline decomposed into timing, competitive and discounting effects.",
    proves: "Detection, decomposition, causal refutation, action assignment, cost telemetry.",
  },
  B: {
    id: "B",
    label: "Same anomaly, regional view",
    persona: "RSM",
    kpiId: "revenue",
    description: "The same underlying movement, scoped and reframed for the accountable regional owner.",
    proves: "Row level entitlement, scoped materiality, withheld actions, persona specific narration.",
  },
  C: {
    id: "C",
    label: "Sparse history abstention",
    persona: "CFO",
    kpiId: "newMarket",
    description: "A launch market with six months of history. The engine reports and refuses to infer.",
    proves: "Abstention by rule, zero model spend, an explicit unlock condition.",
  },
  D: {
    id: "D",
    label: "Contradictory evidence",
    persona: "CFO",
    kpiId: "returnRate",
    description: "Returns rise while satisfaction rises. The engine asks one question instead of guessing.",
    proves: "Cross source contradiction gate, clarification loop, no fabricated cause.",
  },
};

export const SCENARIO_ORDER: Scenario["id"][] = ["A", "B", "C", "D"];
