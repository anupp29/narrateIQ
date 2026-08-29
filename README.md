# NarrateIQ

**A KPI intelligence-to-action engine.** NarrateIQ turns raw operating data into a persona-specific decision brief: what moved, whether it is real, why it moved, what to do about it, who owns it, and how it will be monitored. When the evidence does not support a cause, it abstains and says so.

Built for Track 3, BusinessIntelligence.ai, Accenture Innovation Challenge 2026.

The commercial case, pilot plan, value model and risk register are in [BUSINESS_PROPOSAL.md](./BUSINESS_PROPOSAL.md). This document covers the product and the engineering.

---

## 1. The problem, restated

Enterprise BI reliably answers *what happened*. It rarely answers *why it happened*, *what to do next*, and *who is accountable*. Analysts spend their week rebuilding the same causal story by hand across CRM, marketing, operations, survey and finance extracts. Meanwhile, generative narration tools produce fluent commentary that is frequently wrong, because they infer causality from correlation and cannot say "I do not know".

NarrateIQ addresses that gap with a strict separation of duties:

| Layer | Responsibility | Implementation |
| --- | --- | --- |
| Detection, decomposition, causality | Decide what is true | Deterministic statistics. No model involved. |
| Narration | Explain what is already true | Language model, constrained to computed facts. |

The language model never decides whether something is an anomaly, never ranks a driver, never invents a number. Every figure it may use is supplied in a whitelist, and a guard rejects the draft if it emits a number that is not on that list.

---

## 2. What the prototype does

1. **Ingests seven source extracts** at three different grains and cadences (daily CRM deals, weekly marketing spend, weekly operations returns, weekly NPS, weekly external market signals, monthly finance for a new market, plus free-text CRM notes).
2. **Aligns them** onto a common weekly reporting calendar, records the SLA lag of each source, and scores source quality before use.
3. **Detects material movement** per KPI using deseasonalised residuals and a robust (MAD-based) z score, gated by an absolute materiality threshold in dollars, so statistical noise never reaches a decision-maker.
4. **Decomposes the movement** across dimensions (region, segment, product) and across volume, price, mix, interaction and timing effects.
5. **Estimates causality** using OLS on a daily panel with lag structure, then subjects every candidate driver to a three-test refutation battery: placebo period, common-cause control, and subset stability. Drivers that fail are shown as *rejected*, with the reason.
6. **Retrieves corroborating evidence** from CRM notes and support tickets with TF-IDF, so each driver is backed by a human artefact, not only a coefficient.
7. **Maps validated drivers to governed actions** from a playbook: owner, deadline, expected impact in dollars, and the monitoring metric with its check date.
8. **Abstains** when history is too short, when sources contradict each other, or when no driver survives refutation. Abstention is a first-class output, not a failure state.
9. **Narrates** the validated result for the reader's role, then logs the tokens, latency, route decision and cost of that call.

---

## 3. Judging criteria mapped to code

| Requirement | Where it lives | How to see it in the demo |
| --- | --- | --- |
| Governed KPI semantics | `src/engine/semantic.ts` | Footer, "KPI definitions": formula, grain, calendar, thresholds, lineage, known conflicts. |
| Multi-source, multi-grain reconciliation | `src/engine/reconcile.ts` | Brief section "Sources and grain alignment", showing lag and quality per source. |
| Non-LLM anomaly detection | `src/engine/metrics.ts`, `src/engine/stats.ts` | Dashboard signal badges; brief header shows z score against threshold. |
| Non-LLM causal inference | `src/engine/causal.ts` | Driver table with coefficient, p value, and the three refutation tests. |
| Contribution decomposition | `src/engine/contribution.ts` | Contribution bars summing to the movement, with residual unexplained share. |
| Abstention under uncertainty | `src/engine/pipeline.ts` | Scenarios C and D. |
| Action with ownership and monitoring | `src/engine/actions.ts` | "Assigned actions" table: owner, due date, expected impact, monitoring metric. |
| Role-based access and audit | `src/engine/rbac.ts` | Scenario B: same KPI, filtered rows, restricted drivers, entitlement banner. Telemetry shows the access log. |
| Cost and latency governance | `src/engine/cost.ts` | Telemetry: model route, cache hit, tokens, cost per insight, zero spend on noise and abstention. |
| Human feedback loop | `src/engine/feedback.ts` | Brief footer: accept / reject / request clarification, which updates driver priors and alert precision. |
| Drift and model health | `src/engine/drift.ts` | Telemetry: population stability index per feature and detection precision. |
| Hallucination control | `src/engine/narration.ts`, `src/lib/narrate.functions.ts` | Numeric guard; on violation the brief falls back to the deterministic template and labels it. |

---

## 4. The four demo scenarios

Selectable from the scenario bar. Each recomputes from the source extracts on selection; nothing is pre-rendered.

| ID | Scenario | Proves |
| --- | --- | --- |
| A | CFO, Total Revenue anomaly | Full chain: detection, decomposition, refuted and validated drivers, actions. |
| B | Regional manager, same KPI | Entitlement scoping changes the data, the attribution and the recommended action. |
| C | CFO, New Market Revenue | Abstention on sparse history: 6 of 24 required observations. |
| D | CFO, Product Return Rate | Abstention on contradiction: operations data and survey data disagree. |

Scenario B is the important one. Given the same metric, the regional manager sees a different attribution than the CFO because row-level entitlement changes the panel the regression is fitted on. This is a property of the engine, not a hand-written variant.

---

## 5. Architecture

```text
 CSV extracts (7)          src/data/csv/
        |
   csv.ts  ->  datasets.ts        typed, lazily parsed adapters
        |
   reconcile.ts                   grain alignment, SLA lag, quality score
        |
   semantic.ts                    governed KPI contract + entitlements
        |
   metrics.ts                     deseasonalise -> robust z -> materiality gate
        |
   contribution.ts                dimensional + effect decomposition
        |
   causal.ts                      OLS panel + refutation battery
        |
   retrieval.ts                   TF-IDF evidence from notes and tickets
        |
   actions.ts                     playbook: owner, impact, monitoring
        |
   pipeline.ts   runBrief()       orchestration + step trace + abstention
        |                                 |
   narration.ts -> narrate.functions.ts   | deterministic template (fallback)
        |  Lovable AI Gateway, server side
        v
   DecisionBrief.tsx
```

Supporting modules: `rbac.ts` (personas, clearance, access log), `cost.ts` (model routing, cache, cost model), `drift.ts` (PSI, precision), `feedback.ts` (priors from analyst decisions), `scenarios.ts` (demo states), `stats.ts` (decomposition, CUSUM, OLS, Holt, PSI).

---

## 6. Determinism

The same input produces the same brief, every time.

- No wall-clock reads inside the engine. The as-of date is a fixed contract value.
- No randomness at runtime. The synthetic extracts were generated once from a seeded generator and are committed as CSV.
- Model narration is cached on a hash of the computed payload, so a re-run of the same brief returns the same sentence.
- If the gateway is unavailable, the brief renders from the deterministic template and is labelled as such. The demo never depends on a network call to be correct.

---

## 7. Data

Seven extracts in `src/data/csv/`, deliberately imperfect to exercise the engine:

| File | Grain | Represents |
| --- | --- | --- |
| `crm_deals_daily.csv` | day x region x segment x product | Closed-won revenue, units, discount, list price. |
| `marketing_spend_weekly.csv` | week x region x channel | Spend and impressions, arriving 3 days late. |
| `ops_returns_weekly.csv` | week x product | Units returned and shipped. |
| `nps_weekly.csv` | week x segment | Survey responses, small sample, higher variance. |
| `market_signals_weekly.csv` | week x region | External competitor price index, estimated not observed. |
| `finance_newmarket_monthly.csv` | month | New market revenue, 6 months of history only. |
| `crm_notes.csv` | event | Free-text account notes and support tickets for evidence retrieval. |

The interesting properties are the defects: the monthly file is too short to support inference, the survey file disagrees with the operations file on returns, and the market signal is a weekly estimate that cannot support a daily claim. Each defect drives a visible behaviour in the product.

---

## 8. Running it

```sh
npm install
npm run dev
```

Then open the local URL, choose a persona, and use the scenario bar. Narration uses the Lovable AI Gateway from a server function; without it the app still runs on deterministic narration.

---

## 9. Honest limitations

- Data is synthetic. The engine is real, the business is not.
- Causal estimates are observational. Refutation tests reduce the risk of a spurious driver but do not establish counterfactual truth; a randomised test would.
- Feedback updates driver priors in session state, not in a persisted store.
- Entitlement enforcement is implemented in the engine, not in a database policy layer, which is where it would belong in production.
- The playbook is curated. Expected impact figures are derived from the computed contribution, but the intervention library itself is human-authored, by design.

---

## 10. What production would add

1. Push semantics and entitlements into the warehouse, so the contract is enforced at the query layer rather than in application code.
2. Persist feedback and recompute driver priors and alert thresholds on a schedule, closing the learning loop across users.
3. Add experiment support so recommended actions can be measured against a holdout rather than a monitoring metric alone.
4. Extend the refutation battery with sensitivity analysis for unobserved confounding.
5. Add an approval workflow between recommended action and assigned action, with the audit trail attached to the brief that produced it.
