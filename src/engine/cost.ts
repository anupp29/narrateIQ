/**
 * LLM economics: model routing, caching and cost per insight.
 *
 * Routing is a business rule, not a model decision. Simple briefs are routed
 * to the cheap tier, complex multi-driver briefs to the stronger tier, and
 * abstentions never reach a model at all.
 */

export type ModelTier = "none" | "light" | "standard";

export interface ModelRoute {
  tier: ModelTier;
  model: string;
  reason: string;
  inputPricePerMTokens: number;
  outputPricePerMTokens: number;
}

const CATALOG: Record<Exclude<ModelTier, "none">, Omit<ModelRoute, "reason" | "tier">> = {
  light: {
    model: "google/gemini-3.1-flash-lite",
    inputPricePerMTokens: 0.1,
    outputPricePerMTokens: 0.4,
  },
  standard: {
    model: "google/gemini-3.7-flash",
    inputPricePerMTokens: 0.3,
    outputPricePerMTokens: 2.5,
  },
};

export function routeModel(input: {
  abstain: boolean;
  signal: string;
  driverCount: number;
  materiality: string;
}): ModelRoute {
  if (input.abstain || input.signal === "NOISE") {
    return {
      tier: "none",
      model: "none",
      reason:
        input.signal === "NOISE"
          ? "Movement is within normal variance, so no narrative is generated and no tokens are spent."
          : "Abstention was decided by deterministic rules before narrative generation, so no tokens are spent.",
      inputPricePerMTokens: 0,
      outputPricePerMTokens: 0,
    };
  }
  const complex = input.driverCount >= 2 || input.materiality === "HIGH";
  const tier: Exclude<ModelTier, "none"> = complex ? "standard" : "light";
  return {
    tier,
    ...CATALOG[tier],
    reason: complex
      ? "Multi-driver, high materiality brief routed to the stronger tier for narrative quality."
      : "Single driver, lower materiality brief routed to the low cost tier.",
  };
}

export function estimateCost(route: ModelRoute, inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * route.inputPricePerMTokens +
    (outputTokens / 1_000_000) * route.outputPricePerMTokens
  );
}

export const formatCost = (usd: number): string => `$${usd.toFixed(4)}`;

/**
 * Narrative cache. The key is the persona plus a hash of the computed payload,
 * so an unchanged brief is never re-generated and never re-billed.
 */
export interface CacheEntry {
  key: string;
  narrative: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  createdAt: number;
}

const cache = new Map<string, CacheEntry>();

export function hashPayload(value: unknown): string {
  const json = JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export const cacheGet = (key: string): CacheEntry | undefined => cache.get(key);
export const cacheSet = (entry: CacheEntry): void => {
  cache.set(entry.key, entry);
};
export const cacheStats = () => ({ entries: cache.size });
