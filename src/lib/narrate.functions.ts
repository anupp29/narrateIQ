/**
 * Narration server function.
 *
 * The only place in the system that calls a language model. It receives an
 * already computed payload, routes it to a model tier by business rule,
 * checks the output with a deterministic numeric guard, and returns the
 * narrative together with its full cost and latency record. If the gateway is
 * unavailable, the caller keeps the deterministic summary and the interface
 * says so rather than pretending a model ran.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { estimateCost, hashPayload, routeModel } from "@/engine/cost";
import { buildNarrationPrompt, guardNarrative, NARRATION_SYSTEM_PROMPT, type NarrationPayload } from "@/engine/narration";

const PayloadSchema = z.object({
  kpiName: z.string(),
  persona: z.string(),
  personaLabel: z.string(),
  outcome: z.enum(["BRIEF", "ABSTAIN", "CLARIFY"]),
  headline: z.string(),
  facts: z.array(z.object({ key: z.string(), value: z.string(), numeric: z.number().optional() })),
  drivers: z.array(
    z.object({
      label: z.string(),
      contribution: z.string(),
      confidence: z.string(),
      rejected: z.boolean(),
      reason: z.string().optional(),
    }),
  ),
  actions: z.array(
    z.object({ action: z.string(), owner: z.string(), deadline: z.string(), expectedImpact: z.string() }),
  ),
  uncertainty: z.string(),
  forbidden: z.array(z.string()),
  signal: z.string(),
  materiality: z.string(),
});

export interface NarrationResult {
  text: string | null;
  source: "LLM" | "LLM_CACHED" | "GUARD_REJECTED" | "SKIPPED" | "GATEWAY_UNAVAILABLE";
  model: string;
  tier: string;
  routeReason: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  cacheHit: boolean;
  guardVerdict: string;
  promptPreview: string;
}

const approxTokens = (text: string): number => Math.ceil(text.length / 4);

const cache = new Map<string, { text: string; model: string; inputTokens: number; outputTokens: number }>();

export const narrateBrief = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PayloadSchema.parse(input))
  .handler(async ({ data }): Promise<NarrationResult> => {
    const payload = data as NarrationPayload & { signal: string; materiality: string };
    const route = routeModel({
      abstain: payload.outcome !== "BRIEF",
      signal: payload.signal,
      driverCount: payload.drivers.filter((d) => !d.rejected).length,
      materiality: payload.materiality,
    });
    const prompt = buildNarrationPrompt(payload);
    const promptPreview = prompt.slice(0, 1200);

    if (route.tier === "none") {
      return {
        text: null,
        source: "SKIPPED",
        model: "none",
        tier: "none",
        routeReason: route.reason,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs: 0,
        cacheHit: false,
        guardVerdict: "Not run. No model was called.",
        promptPreview,
      };
    }

    const key = `${payload.persona}:${hashPayload(payload)}`;
    const cached = cache.get(key);
    if (cached) {
      return {
        text: cached.text,
        source: "LLM_CACHED",
        model: cached.model,
        tier: route.tier,
        routeReason: `${route.reason} Served from the narrative cache, so no tokens were spent on this request.`,
        inputTokens: cached.inputTokens,
        outputTokens: cached.outputTokens,
        costUsd: 0,
        latencyMs: 0,
        cacheHit: true,
        guardVerdict: "Guard passed on first generation. Cached output is byte identical.",
        promptPreview,
      };
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return {
        text: null,
        source: "GATEWAY_UNAVAILABLE",
        model: route.model,
        tier: route.tier,
        routeReason: route.reason,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs: 0,
        cacheHit: false,
        guardVerdict: "Not run. The gateway credential is not configured, so the deterministic summary is shown.",
        promptPreview,
      };
    }

    const started = Date.now();
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
        body: JSON.stringify({
          model: route.model,
          temperature: 0,
          messages: [
            { role: "system", content: NARRATION_SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        return {
          text: null,
          source: "GATEWAY_UNAVAILABLE",
          model: route.model,
          tier: route.tier,
          routeReason: route.reason,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          latencyMs: Date.now() - started,
          cacheHit: false,
          guardVerdict:
            response.status === 429
              ? "Gateway rate limited the request. The deterministic summary is shown and the brief is unaffected."
              : response.status === 402
                ? "Gateway reported that the workspace has no remaining AI credits. The deterministic summary is shown and the brief is unaffected."
                : `Gateway returned ${response.status}. ${detail.slice(0, 200)}`,
          promptPreview,
        };
      }

      const json = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const text = (json.choices?.[0]?.message?.content ?? "").trim().replace(/\u2014/g, ", ");
      const inputTokens = json.usage?.prompt_tokens ?? approxTokens(prompt) + approxTokens(NARRATION_SYSTEM_PROMPT);
      const outputTokens = json.usage?.completion_tokens ?? approxTokens(text);
      const costUsd = estimateCost(route, inputTokens, outputTokens);
      const latencyMs = Date.now() - started;

      const guard = guardNarrative(text, payload);
      if (!guard.passed || text.length < 40) {
        return {
          text: null,
          source: "GUARD_REJECTED",
          model: route.model,
          tier: route.tier,
          routeReason: route.reason,
          inputTokens,
          outputTokens,
          costUsd,
          latencyMs,
          cacheHit: false,
          guardVerdict: guard.passed
            ? "Guard rejected the narrative because it was too short to be a usable summary."
            : guard.verdict,
          promptPreview,
        };
      }

      cache.set(key, { text, model: route.model, inputTokens, outputTokens });
      return {
        text,
        source: "LLM",
        model: route.model,
        tier: route.tier,
        routeReason: route.reason,
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs,
        cacheHit: false,
        guardVerdict: guard.verdict,
        promptPreview,
      };
    } catch (error) {
      return {
        text: null,
        source: "GATEWAY_UNAVAILABLE",
        model: route.model,
        tier: route.tier,
        routeReason: route.reason,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs: Date.now() - started,
        cacheHit: false,
        guardVerdict: `Gateway unreachable: ${error instanceof Error ? error.message : "unknown error"}. The deterministic summary is shown.`,
        promptPreview,
      };
    }
  });
