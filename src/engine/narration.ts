/**
 * Narration contract.
 *
 * The language model is used for one job only: turning a computed payload
 * into readable prose. It is never asked what caused anything, never asked
 * to rank actions, and never given raw rows. Everything it is allowed to say
 * is enumerated in the payload, and a deterministic guard checks the output
 * before it reaches the interface.
 */

export interface NarrationFact {
  key: string;
  value: string;
  numeric?: number;
}

export interface NarrationPayload {
  kpiName: string;
  persona: string;
  personaLabel: string;
  outcome: "BRIEF" | "ABSTAIN" | "CLARIFY";
  headline: string;
  facts: NarrationFact[];
  drivers: { label: string; contribution: string; confidence: string; rejected: boolean; reason?: string }[];
  actions: { action: string; owner: string; deadline: string; expectedImpact: string }[];
  uncertainty: string;
  forbidden: string[];
}

export const NARRATION_SYSTEM_PROMPT = `You are the narration component of a KPI intelligence engine used by finance and sales leadership.

Your only job is to express an already computed analysis in clear business English.

Hard rules:
1. Use only the figures, driver labels and actions supplied in the payload. Never introduce a number, percentage, currency amount, date or name that is not present in the payload.
2. Never propose a cause, a driver or an action that is not in the payload. If the payload says the engine abstained, say so plainly and do not speculate.
3. Never soften or omit a rejected hypothesis or an unexplained share. Uncertainty is part of the message.
4. Write for the stated persona. A chief financial officer needs group consequence and decision rights. A regional sales manager needs the specific accounts, the lever available to them and the deadline.
5. Four to six sentences. No headings, no bullet points, no preamble, no closing pleasantries, no em dashes, no exclamation marks.
6. State the action, owner and deadline explicitly when actions are present.

You are accountable for readability. You are not accountable for the analysis, and you must not attempt to improve it.`;

export function buildNarrationPrompt(payload: NarrationPayload): string {
  const lines: string[] = [];
  lines.push(`Persona: ${payload.personaLabel}`);
  lines.push(`KPI: ${payload.kpiName}`);
  lines.push(`Engine outcome: ${payload.outcome}`);
  lines.push(`Headline: ${payload.headline}`);
  lines.push("");
  lines.push("Computed facts you may use:");
  payload.facts.forEach((f) => lines.push(`- ${f.key}: ${f.value}`));
  if (payload.drivers.length) {
    lines.push("");
    lines.push("Drivers as validated by the engine:");
    payload.drivers.forEach((d) =>
      lines.push(
        `- ${d.label}: ${d.contribution}, confidence ${d.confidence}${d.rejected ? `, REJECTED because ${d.reason}` : ""}`,
      ),
    );
  }
  if (payload.actions.length) {
    lines.push("");
    lines.push("Assigned actions:");
    payload.actions.forEach((a) =>
      lines.push(`- ${a.action} Owner ${a.owner}, due ${a.deadline}, expected impact ${a.expectedImpact}`),
    );
  }
  lines.push("");
  lines.push(`Stated uncertainty that must appear: ${payload.uncertainty}`);
  if (payload.forbidden.length) {
    lines.push("");
    lines.push(`Do not mention: ${payload.forbidden.join("; ")}`);
  }
  lines.push("");
  lines.push("Write the narrative now.");
  return lines.join("\n");
}

const NUMBER_RE = /-?\$?\d[\d,]*\.?\d*\s?(?:percent|%|K|M|k|m)?/g;

const normalise = (token: string): number | null => {
  const cleaned = token.replace(/[$,\s]/g, "").toLowerCase();
  const mult = cleaned.endsWith("k") ? 1000 : cleaned.endsWith("m") ? 1_000_000 : 1;
  const num = parseFloat(cleaned.replace(/(percent|%|k|m)$/g, ""));
  if (Number.isNaN(num)) return null;
  return num * mult;
};

/**
 * Rejects any narrative containing a figure that is not present in the
 * computed payload. Dates and identifiers are matched literally, numbers
 * within a one percent tolerance to allow for rounding in prose.
 */
export function guardNarrative(
  text: string,
  payload: NarrationPayload,
): { passed: boolean; verdict: string; offending: string[] } {
  const allowedText = [
    payload.headline,
    payload.uncertainty,
    ...payload.facts.map((f) => `${f.value}`),
    ...payload.drivers.map((d) => `${d.contribution} ${d.reason ?? ""}`),
    ...payload.actions.map((a) => `${a.action} ${a.deadline} ${a.expectedImpact}`),
  ].join(" ");

  const allowedNumbers = new Set<number>();
  (allowedText.match(NUMBER_RE) ?? []).forEach((t) => {
    const n = normalise(t);
    if (n !== null) {
      allowedNumbers.add(Math.abs(n));
      allowedNumbers.add(Math.abs(Math.round(n)));
    }
  });
  payload.facts.forEach((f) => {
    if (typeof f.numeric === "number") allowedNumbers.add(Math.abs(f.numeric));
  });

  const offending: string[] = [];
  (text.match(NUMBER_RE) ?? []).forEach((t) => {
    const n = normalise(t);
    if (n === null) return;
    const abs = Math.abs(n);
    if (abs === 0) return;
    const ok = [...allowedNumbers].some((a) => Math.abs(a - abs) <= Math.max(1, Math.abs(a) * 0.01));
    if (!ok) offending.push(t.trim());
  });

  if (offending.length) {
    return {
      passed: false,
      verdict: `Guard rejected the narrative. ${offending.length} figure${offending.length === 1 ? "" : "s"} not present in the computed payload: ${offending.join(", ")}. The deterministic summary was shown instead.`,
      offending,
    };
  }
  return {
    passed: true,
    verdict: `Guard passed. Every figure in the narrative matches a computed value, ${allowedNumbers.size} values checked.`,
    offending: [],
  };
}
