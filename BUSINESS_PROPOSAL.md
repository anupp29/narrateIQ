# NarrateIQ: Business Proposal

**Track 3, BusinessIntelligence.ai. Accenture Innovation Challenge 2026.**
Prepared as a business case for taking the NarrateIQ prototype into a funded pilot.

---

## 1. Executive summary

Large enterprises have solved reporting and have not solved explanation. Dashboards tell an executive that revenue fell 13 percent. They do not tell them that 80 percent of the fall is a billing platform migration that will reverse itself, that 12 percent is a live competitor price cut that will not, and that these two facts require entirely different responses from two different owners on two different deadlines.

That gap is closed today by analysts, manually, one question at a time. It is slow, it is inconsistent between analysts, and it is unauditable.

NarrateIQ closes the gap with software. It detects material KPI movement statistically, decomposes it, tests candidate causes against a refutation battery, maps surviving causes to owned actions with monitoring plans, and only then uses a language model to write the result up for the reader's role. When the evidence is insufficient, it abstains and states why.

**The ask:** a 12 week paid pilot on two KPI families in one business unit, with a defined success gate before any scale decision.

---

## 2. The problem, in business terms

| Symptom | Business consequence |
| --- | --- |
| Time from a KPI moving to a credible explanation is measured in days | Decisions are made on stale or incomplete causality, or deferred |
| Every analyst reconstructs causality differently | The same movement gets two explanations in two meetings, eroding trust in the numbers |
| Explanations end at insight, not at an owner | Nothing changes; the same variance is re-explained the following month |
| Generative narration tools state causes confidently and are sometimes wrong | A single fabricated cause in a board pack destroys adoption permanently |
| Analysts spend most of their week on variance archaeology | The scarcest analytical capacity in the company is spent on repeatable work |

The last two are the ones that kill projects. Any credible solution must be *right*, must *say when it is not sure*, and must produce an *accountable next step*.

---

## 3. Solution and what makes it defensible

NarrateIQ separates judgement from language.

- **Judgement is deterministic.** Detection, decomposition, and causal estimation are statistics. Same input, same answer, every time, fully auditable.
- **Language is constrained.** The model receives only computed facts and is rejected if it emits a number that was not supplied to it. It writes; it does not decide.
- **Uncertainty is a product feature.** Sparse history, contradictory sources, and drivers that fail refutation produce a stated abstention rather than a confident guess.
- **Output is an action, not an insight.** Every validated driver carries an owner, a deadline, an expected impact, and the metric that will be checked to confirm the action worked.
- **Access is enforced before data is read.** The same KPI produces a different, correctly scoped brief for a CFO and for a regional manager.

The defensible position is not the language model, which is a commodity. It is the governed semantic contract, the refutation battery, the abstention policy, and the accumulated feedback that tunes driver priors to a specific business. Those are earned over time inside a customer and are not easily copied.

---

## 4. Who it is for

| Segment | Primary buyer | Pain that opens the budget |
| --- | --- | --- |
| Enterprise Finance, 1B USD and above revenue | CFO, Group Controller | Month-end variance explanation cycle and board reporting credibility |
| Commercial and Sales Operations | VP Revenue Operations | Regional performance disputes and slow pipeline diagnosis |
| Supply chain and Operations | COO | Returns, defect and service level anomalies with unclear root cause |
| Data and Analytics organisation | Chief Data Officer | Analyst capacity, and governance risk from ungoverned AI narration |

Entry wedge is Finance. Finance has the clearest calendar pressure, the highest cost of being wrong, and a named owner for every metric.

---

## 5. Value case

Illustrative, for a business unit with 1B USD revenue and 12 analysts supporting recurring KPI reporting. Every figure below is a modelling assumption to be validated in the pilot, not a claimed result.

**Cost side**

| Driver | Assumption | Annual value |
| --- | --- | --- |
| Analyst time on recurring variance explanation | 12 analysts, 30 percent of time, 120K USD loaded cost | 432K USD addressable |
| Realistic reduction in that effort | 40 percent | 173K USD |
| Executive time in variance review meetings | 8 leaders, 3 hours per month, 250 USD per hour | 72K USD addressable |
| Realistic reduction | 30 percent | 22K USD |

**Decision side**

| Driver | Assumption | Annual value |
| --- | --- | --- |
| Margin leakage caught earlier through faster attribution | 0.05 percent of revenue | 500K USD |
| Avoided misdirected intervention (acting on a cause that later fails refutation) | 2 events per year, 75K USD each | 150K USD |

The cost side is the credible, defensible part of the case and is sufficient on its own for a pilot. The decision side is the reason the programme scales, and must be evidenced in the pilot rather than assumed.

**Indicative pilot economics:** 12 week pilot, 2 KPI families, one business unit. Payback is demonstrated on the cost side alone within the first year if the effort reduction assumption holds at even half the modelled rate.

---

## 6. Why now

1. Semantic layers and warehouse-native governance are now standard, so a governed KPI contract can be enforced rather than documented.
2. Model inference cost has fallen to the point where narration is a rounding error, which moves the constraint from cost to trust.
3. The first wave of generative BI narration has shipped and has produced visible hallucination incidents. Buyers are now specifically asking for verifiable, abstaining systems.
4. Regulatory and audit expectations around AI-assisted reporting are tightening, which favours architectures that can show their working.

---

## 7. Competitive position

| Alternative | Where it stops | NarrateIQ difference |
| --- | --- | --- |
| BI platforms with narration add-ons | Describe the chart in words | Causal attribution with refutation and stated uncertainty |
| Chat-over-your-data tools | Answer the question asked, correlationally | Detect unasked movement, and refuse to answer when evidence is thin |
| Anomaly detection point solutions | Alert on the movement | Explain it, and assign an owned action with a monitoring plan |
| Internal analyst team | Correct, but slow, inconsistent, and unscalable | Consistent, auditable, immediate, and it augments rather than replaces the team |

The honest competitor is the analyst team. The pitch is not replacement. It is that the first eighty percent of every variance investigation is mechanical, and analysts should start from a tested hypothesis set rather than a blank query editor.

---

## 8. Commercial model

Platform subscription by business unit, with a KPI family entitlement, plus a professional services component for onboarding the semantic contract and the action playbook. Inference cost is metered and reported per insight in the product, which makes the cost of the system visible and defensible to the buyer rather than hidden.

Pricing is deliberately not tied to number of users. The value is the governed contract and the accumulated feedback, both of which scale with metrics and business units, not with seats.

---

## 9. Adoption and change plan

Adoption fails when the system asserts authority it has not earned. The rollout is therefore staged by trust.

| Stage | Duration | Mode | Exit condition |
| --- | --- | --- | --- |
| Shadow | Weeks 1 to 4 | Engine runs, analysts compare against their own conclusions, nothing is published | Agreement rate above the agreed threshold on validated drivers |
| Assist | Weeks 5 to 8 | Briefs are published as draft; an analyst signs each one before circulation | Analyst edit rate falling, review time falling |
| Operate | Weeks 9 to 12 | Briefs circulate automatically; analysts review exceptions and abstentions | Named owners accepting assigned actions |

Every brief carries accept, reject and request clarification. Rejections update driver priors and are the primary input to measured precision. A system that cannot be corrected will not be trusted.

---

## 10. Pilot plan and success gate

**Scope:** one business unit, two KPI families, four source systems, two personas.

**Weeks 1 to 3.** Semantic contract workshop. Agree definitions, grain, reporting calendar, materiality thresholds and accountable owner per KPI. This is the highest value and highest friction activity in the engagement, and it produces durable asset regardless of the pilot outcome.

**Weeks 4 to 6.** Source onboarding, grain reconciliation, quality scoring, historical backfill for baselines.

**Weeks 7 to 9.** Shadow and assist operation. Playbook authoring with the accountable owners.

**Weeks 10 to 12.** Operate mode, measurement, and scale decision.

**Success gate, agreed before start.** The pilot continues only if all four are met.

| Measure | Threshold |
| --- | --- |
| Driver agreement with analyst conclusion on reviewed briefs | 80 percent or above |
| Fabricated figures in published narration | Zero |
| Median time from data availability to circulated brief | Under 30 minutes |
| Assigned actions accepted by a named owner | 70 percent or above |

Deliberately excluded from the gate: user satisfaction scores and usage volume. Both can be high while the system is quietly wrong.

---

## 11. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Semantic definitions are contested between functions | High | High | Contract workshop is week one and is a named deliverable with a single accountable owner per KPI. No metric goes live without it. |
| Model states a cause that is wrong | Medium | Severe | The model never selects causes. Numeric guard, deterministic fallback, and analyst sign-off in the assist stage. |
| Correlation presented as causation | Medium | Severe | Three-test refutation battery, visible rejected drivers, explicit unexplained residual on every brief. |
| Source data quality is worse than expected | High | Medium | Quality scoring and SLA lag per source are computed and shown. Sources below threshold trigger abstention rather than a weak answer. |
| Actions are recommended but never executed | High | High | Owner and deadline are mandatory fields. Monitoring metric and check date are part of the brief. Acceptance rate is a gate measure. |
| Organisational resistance from the analyst team | Medium | High | Positioned as hypothesis generation. Analysts own the semantic contract and the playbook, and hold the reject control. |
| Inference cost drifts as usage grows | Low | Medium | Deterministic path costs nothing. Model is reached only for validated, material briefs. Cost per insight is metered and visible. |
| Model behaviour changes with provider updates | Medium | Medium | Narration is cached against a payload hash and guarded. A regression in narration cannot change a computed conclusion. |

The two risks that decide the programme are the semantic contract dispute and action execution. Both are organisational, not technical, which is why both appear in the success gate.

---

## 12. Roadmap after the pilot

| Horizon | Focus |
| --- | --- |
| Quarter 1 | Push semantics and entitlements into the warehouse so the contract is enforced at query layer. Persist feedback. |
| Quarter 2 | Cross-KPI causal chains. Attribute a margin movement through revenue and returns rather than treating each in isolation. |
| Quarter 3 | Action outcome measurement against a holdout, replacing monitoring-metric confirmation with measured effect. |
| Quarter 4 | Multi business unit rollout, benchmark comparison across units, and a shared playbook library. |

---

## 13. Recommendation

Fund the 12 week pilot on the scope in section 10, against the four-measure gate. The pilot produces a governed semantic contract and an action playbook that retain value to the organisation even if the scale decision is negative.

Do not fund a broad multi-unit rollout at this stage. The binding constraint on this category is trust, and trust is earned one correctly abstained brief at a time.
