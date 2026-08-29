export type Persona = "CFO" | "RSM";

export const PERSONA_LABEL: Record<Persona, string> = {
  CFO: "Chief Financial Officer",
  RSM: "Regional Sales Manager",
};

export type Signal = "ANOMALY" | "WATCH" | "NOISE" | "SPARSE" | "LOCKED";

export interface Kpi {
  id: string;
  name: string;
  value: number;
  valueFormatted: string;
  change: number;
  unit: string;
  source: string;
  cadence: string;
  lastUpdated: string;
  freshness: "current" | "approaching" | "overdue";
  signal: Exclude<Signal, "LOCKED">;
  zScore: number | null;
  materiality: string;
  baselineValue?: number;
  sparkline: number[];
  accessRoles: Persona[];
  detectionMethod: string;
  anomalyWindow?: string;
  historyMonths?: number;
}

export const KPI_DATA: Record<string, Kpi> = {
  revenue: {
    id: "revenue",
    name: "Total Revenue",
    value: 4200000,
    valueFormatted: "$4.2M",
    change: -8.2,
    unit: "USD",
    source: "CRM Daily Feed",
    cadence: "Daily",
    lastUpdated: "2 hours ago",
    freshness: "current",
    signal: "ANOMALY",
    zScore: 3.1,
    materiality: "HIGH",
    baselineValue: 4574000,
    sparkline: [4580000, 4620000, 4590000, 4610000, 4550000, 4480000, 4390000, 4280000, 4200000],
    accessRoles: ["CFO", "RSM"],
    detectionMethod: "STL Decomposition + CUSUM",
    anomalyWindow: "21 days",
  },
  cac: {
    id: "cac",
    name: "Customer Acquisition Cost",
    value: 340,
    valueFormatted: "$340",
    change: 12.0,
    unit: "USD per customer",
    source: "Marketing Platform (Weekly)",
    cadence: "Weekly",
    lastUpdated: "3 days ago",
    freshness: "current",
    signal: "WATCH",
    zScore: 1.8,
    materiality: "MEDIUM",
    baselineValue: 304,
    sparkline: [298, 302, 310, 305, 318, 325, 334, 340],
    accessRoles: ["CFO", "RSM"],
    detectionMethod: "STL Decomposition + CUSUM",
  },
  aov: {
    id: "aov",
    name: "Average Order Value",
    value: 1840,
    valueFormatted: "$1,840",
    change: -3.1,
    unit: "USD",
    source: "CRM Daily Feed",
    cadence: "Daily",
    lastUpdated: "2 hours ago",
    freshness: "current",
    signal: "NOISE",
    zScore: 0.9,
    materiality: "LOW",
    baselineValue: 1898,
    sparkline: [1910, 1895, 1905, 1880, 1870, 1855, 1840],
    accessRoles: ["CFO", "RSM"],
    detectionMethod: "STL Decomposition + CUSUM",
  },
  returnRate: {
    id: "returnRate",
    name: "Product Return Rate",
    value: 7.2,
    valueFormatted: "7.2%",
    change: 18.0,
    unit: "percent",
    source: "Operations System (Weekly)",
    cadence: "Weekly",
    lastUpdated: "1 day ago",
    freshness: "current",
    signal: "ANOMALY",
    zScore: 2.6,
    materiality: "MEDIUM",
    baselineValue: 6.1,
    sparkline: [6.0, 6.1, 6.2, 6.0, 6.3, 6.8, 7.2],
    accessRoles: ["CFO"],
    detectionMethod: "STL Decomposition + CUSUM",
    anomalyWindow: "2 weeks",
  },
  newMarket: {
    id: "newMarket",
    name: "New Market Revenue",
    value: 127000,
    valueFormatted: "$127K",
    change: 4.0,
    unit: "USD",
    source: "CRM Monthly Rollup",
    cadence: "Monthly",
    lastUpdated: "12 days ago",
    freshness: "approaching",
    signal: "SPARSE",
    zScore: null,
    materiality: "INDETERMINATE",
    sparkline: [84000, 96000, 103000, 112000, 122000, 127000],
    historyMonths: 6,
    accessRoles: ["CFO"],
    detectionMethod: "Insufficient history, minimum 24 data points required, 6 available",
  },
};

export const KPI_ORDER = ["revenue", "returnRate", "cac", "newMarket", "aov"];

export interface Scenario {
  id: "A" | "B" | "C" | "D";
  label: string;
  description: string;
  activeKPI: string;
  activePersona: Persona;
}

export const SCENARIOS: Record<"A" | "B" | "C" | "D", Scenario> = {
  A: {
    id: "A",
    label: "Multi-factor Revenue Anomaly",
    description: "Revenue down 8.2%, two interacting drivers, one high confidence, one medium",
    activeKPI: "revenue",
    activePersona: "CFO",
  },
  B: {
    id: "B",
    label: "Sparse History Abstention",
    description: "New market KPI, insufficient history to conclude",
    activeKPI: "newMarket",
    activePersona: "CFO",
  },
  C: {
    id: "C",
    label: "Contradictory Evidence Abstention",
    description: "Return rate up and satisfaction up, system cannot reconcile",
    activeKPI: "returnRate",
    activePersona: "CFO",
  },
  D: {
    id: "D",
    label: "Role-Based Access Demo",
    description: "Switch to RSM, restricted KPIs and different narrative",
    activeKPI: "revenue",
    activePersona: "RSM",
  },
};

export interface ProcessingStep {
  step: string;
  method: string;
  type: "NON-LLM" | "LLM";
  duration: string;
  result: string;
}

export const PROCESSING_STEPS: ProcessingStep[] = [
  {
    step: "Signal validation",
    method: "STL + CUSUM",
    type: "NON-LLM",
    duration: "0.3s",
    result: "Anomaly confirmed: z = 3.1 · Materiality: HIGH",
  },
  {
    step: "Dimensional drill-down",
    method: "SQL waterfall decomposition",
    type: "NON-LLM",
    duration: "0.8s",
    result: "Primary dimension isolated: South region, SMB segment",
  },
  {
    step: "Causal inference",
    method: "DoWhy (backdoor criterion)",
    type: "NON-LLM",
    duration: "1.2s",
    result: "2 drivers validated, 1 rejected as non-causal",
  },
  {
    step: "Evidence retrieval",
    method: "TF-IDF similarity on CRM notes + tickets",
    type: "NON-LLM",
    duration: "0.6s",
    result: "47 CRM notes, 34 tickets matched",
  },
  {
    step: "Narrative generation",
    method: "LLM (narration of pre-computed findings only)",
    type: "LLM",
    duration: "2.1s",
    result: "Brief ready",
  },
];

export interface Evidence {
  type: "CRM" | "SQL" | "Tickets";
  label: string;
  text: string;
  source: string;
  relevanceScore: string;
}

export interface Hypothesis {
  rank: number;
  driver: string;
  contributionPct: number;
  contributionAbs: string;
  confidence: string;
  confidenceScore: number;
  method: string;
  type: "NON-LLM";
  rejected: boolean;
  rejectionReason?: string;
  evidence?: Evidence[];
}

export interface ActionItem {
  rank: number;
  action: string;
  lever: string;
  owner: string;
  deadline: string;
  expectedImpact: string;
  confidence: string;
  decisionRights: string;
  visibleTo: Persona[];
}

export interface Brief {
  kpiName: string;
  persona: string;
  abstain: false;
  generatedAt: string;
  totalLatency: string;
  tokenCount: number;
  estimatedCost: string;
  feedbackCount: number;
  restrictedActionsCount?: number;
  restrictedActionsNotice?: string;
  processingSteps: ProcessingStep[];
  whatChanged: {
    summary: string;
    table: {
      metric: string;
      period: string;
      value: string;
      vsBaseline: string;
      zScore: string;
      materiality: string;
    }[];
    sources: { name: string; cadence: string; freshness: string; status: string }[];
  };
  whyItChanged: { summary: string; hypotheses: Hypothesis[] };
  whatToDo: ActionItem[];
  whatWeDontKnow: {
    abstain: false;
    uncertainty: string;
    resolutionAction?: string;
    resolutionOwner: string;
    resolutionDeadline: string;
    confidenceImpact?: string;
  };
}

export interface AbstentionBrief {
  kpiName: string;
  persona: string;
  abstain: true;
  abstentionType: "SPARSE_HISTORY" | "CONTRADICTORY_EVIDENCE";
  abstentionBanner: string;
  abstentionReason: string;
  whatWeObserve: string;
  hypothesesConsidered: { hypothesis: string; status: string; reason: string }[];
  resolutionPath: {
    action: string;
    interimAction?: string;
    owner: string;
    timeline: string;
  };
  signal: string;
  generatedAt: string;
  totalLatency: string;
  tokenCount: number;
  estimatedCost: string;
  feedbackCount: number;
  note: string;
  processingSteps: ProcessingStep[];
}

const ABSTENTION_STEPS = (reason: string): ProcessingStep[] =>
  PROCESSING_STEPS.map((s, i) => {
    if (i === 2) return { ...s, result: `Abstention triggered: ${reason}` };
    if (i > 2) return { ...s, duration: "n/a", result: "Skipped (zero LLM cost)" };
    return s;
  });

export const BRIEF_REVENUE_CFO: Brief = {
  kpiName: "Total Revenue",
  persona: "CFO",
  abstain: false,
  generatedAt: "Today at 09:14 AM",
  totalLatency: "5.0s",
  tokenCount: 847,
  estimatedCost: "$0.004",
  feedbackCount: 3,
  processingSteps: PROCESSING_STEPS,
  whatChanged: {
    summary:
      "South region SMB revenue declined $374,000 (8.2%) over the 21-day period ending today, sustaining below baseline for 15 consecutive trading days. This movement is statistically significant at 3.1 standard deviations above expected variance and classified as HIGH materiality based on both significance and revenue at risk.",
    table: [
      {
        metric: "Revenue: South, SMB",
        period: "Last 21 days",
        value: "$4.20M",
        vsBaseline: "-$374K (-8.2%)",
        zScore: "3.1σ",
        materiality: "HIGH",
      },
    ],
    sources: [
      {
        name: "CRM Daily Feed",
        cadence: "Daily",
        freshness: "Updated 2 hours ago",
        status: "current",
      },
    ],
  },
  whyItChanged: {
    summary:
      "Causal inference identified two statistically validated drivers accounting for 90% of the observed decline. A third candidate, seasonal variation, was tested and rejected as non-causal at this time window.",
    hypotheses: [
      {
        rank: 1,
        driver: "Competitor pricing action",
        contributionPct: 67,
        contributionAbs: "$251K",
        confidence: "HIGH",
        confidenceScore: 0.84,
        method: "DoWhy CausalModel (backdoor criterion)",
        type: "NON-LLM",
        rejected: false,
        evidence: [
          {
            type: "CRM",
            label: "CRM notes",
            text: "47 CRM call notes in South/SMB between Day -21 and Day 0 reference competitor pricing as reason for delayed purchase or cancellation.",
            source: "CRM Daily Feed",
            relevanceScore: "91%",
          },
          {
            type: "SQL",
            label: "SQL analysis",
            text: "Win rate in South/SMB dropped from 34% to 19% in the same window, a 44% relative decline concentrated in deals above $5K ACV.",
            source: "CRM Daily Feed, waterfall decomposition",
            relevanceScore: "88%",
          },
        ],
      },
      {
        rank: 2,
        driver: "Billing system migration delay",
        contributionPct: 23,
        contributionAbs: "$86K",
        confidence: "MEDIUM",
        confidenceScore: 0.61,
        method: "DoWhy CausalModel (backdoor criterion)",
        type: "NON-LLM",
        rejected: false,
        evidence: [
          {
            type: "Tickets",
            label: "Support tickets",
            text: "34 support tickets in South region between Day -18 and Day -4 cite billing invoice delays or errors. Volume is 340% above the 90-day baseline.",
            source: "Operations System Weekly",
            relevanceScore: "79%",
          },
          {
            type: "SQL",
            label: "SQL analysis",
            text: "Average days-to-invoice in South increased from 4.1 to 9.7 days following billing migration on Day -22.",
            source: "Operations System Weekly",
            relevanceScore: "75%",
          },
        ],
      },
      {
        rank: 3,
        driver: "Seasonal variation",
        contributionPct: 10,
        contributionAbs: "Not causal",
        confidence: "REJECTED",
        confidenceScore: 0.22,
        method: "STL residual analysis",
        type: "NON-LLM",
        rejected: true,
        rejectionReason:
          "Seasonal component fully extracted by STL decomposition. Residual variance after decomposition remains statistically significant, confirming this is not a seasonal movement.",
      },
    ],
  },
  whatToDo: [
    {
      rank: 1,
      action: "Initiate emergency competitive pricing review for South region SMB segment",
      lever: "Pricing strategy",
      owner: "VP Sales, South Region",
      deadline: "48 hours",
      expectedImpact:
        "Arrest further win-rate decline, estimated revenue protection $180K over next 30 days",
      confidence: "HIGH",
      decisionRights: "VP Sales with CFO approval above $50K discount threshold",
      visibleTo: ["CFO"],
    },
    {
      rank: 2,
      action: "Escalate billing migration issue to Engineering as Priority 1 incident",
      lever: "Operational fix",
      owner: "CTO",
      deadline: "Immediate",
      expectedImpact:
        "Restore normal invoice cycle within 5 days, unblock $86K in delayed revenue recognition",
      confidence: "HIGH",
      decisionRights: "CTO, no approval threshold",
      visibleTo: ["CFO"],
    },
    {
      rank: 3,
      action: "Proactive outreach to 47 at-risk accounts identified in CRM analysis",
      lever: "Customer retention",
      owner: "Customer Success Lead",
      deadline: "72 hours",
      expectedImpact: "Estimated 30% retention of at-risk ACV, approximately $65K protected",
      confidence: "MEDIUM",
      decisionRights: "Customer Success Lead, standard retention playbook",
      visibleTo: ["CFO", "RSM"],
    },
  ],
  whatWeDontKnow: {
    abstain: false,
    uncertainty:
      "The relative contribution of pricing pressure versus billing friction to customer churn in the FinServ sub-segment cannot be determined from available data. Both factors were active simultaneously in this segment.",
    resolutionAction:
      "Pull 30-day cohort retention data segmented by billing-affected versus non-billing-affected accounts within the South/SMB/FinServ group.",
    resolutionOwner: "Analytics Lead",
    resolutionDeadline: "5 business days",
    confidenceImpact:
      "Resolving this uncertainty would upgrade the billing migration hypothesis from MEDIUM to HIGH and enable more targeted action prioritisation.",
  },
};

export const BRIEF_REVENUE_RSM: Brief = {
  kpiName: "Total Revenue: Your Region",
  persona: "Regional Sales Manager",
  abstain: false,
  generatedAt: "Today at 09:14 AM",
  totalLatency: "3.8s",
  tokenCount: 612,
  estimatedCost: "$0.003",
  feedbackCount: 3,
  restrictedActionsCount: 2,
  restrictedActionsNotice:
    "2 additional actions are available to CFO and VP Sales; they fall outside your decision rights. Your VP Sales has been automatically notified.",
  processingSteps: PROCESSING_STEPS,
  whatChanged: {
    summary:
      "Your region's SMB revenue declined $374,000 (8.2%) over the past three weeks, sustained below your target for 15 consecutive trading days. This is classified as a material anomaly requiring your immediate attention.",
    table: [
      {
        metric: "Revenue: Your Region, SMB",
        period: "Last 21 days",
        value: "$4.20M",
        vsBaseline: "-$374K (-8.2%)",
        zScore: "3.1σ",
        materiality: "HIGH",
      },
    ],
    sources: [
      {
        name: "CRM Daily Feed",
        cadence: "Daily",
        freshness: "Updated 2 hours ago",
        status: "current",
      },
    ],
  },
  whyItChanged: {
    summary:
      "Two factors have been identified in your region. Competitor pricing activity is the primary driver. A billing system issue is a secondary contributing factor.",
    hypotheses: [
      {
        rank: 1,
        driver: "Competitor pricing action",
        contributionPct: 67,
        contributionAbs: "$251K",
        confidence: "HIGH",
        confidenceScore: 0.84,
        method: "DoWhy CausalModel (backdoor criterion)",
        type: "NON-LLM",
        rejected: false,
        evidence: [
          {
            type: "CRM",
            label: "CRM notes",
            text: "47 CRM call notes in your region reference competitor pricing as reason for delayed purchase or cancellation.",
            source: "CRM Daily Feed",
            relevanceScore: "91%",
          },
        ],
      },
      {
        rank: 2,
        driver: "Billing system migration delay",
        contributionPct: 23,
        contributionAbs: "$86K",
        confidence: "MEDIUM",
        confidenceScore: 0.61,
        method: "DoWhy CausalModel (backdoor criterion)",
        type: "NON-LLM",
        rejected: false,
        evidence: [
          {
            type: "Tickets",
            label: "Support tickets",
            text: "34 support tickets in your region cite billing invoice delays. Volume is 340% above the 90-day baseline.",
            source: "Operations System Weekly",
            relevanceScore: "79%",
          },
        ],
      },
    ],
  },
  whatToDo: [
    {
      rank: 1,
      action: "Review open pipeline for pricing objections, identify deals at immediate risk",
      lever: "Pipeline management",
      owner: "You, Regional Sales Manager",
      deadline: "Today",
      expectedImpact: "Identify and protect top 20% of at-risk deals in your pipeline",
      confidence: "HIGH",
      decisionRights: "Within your authority, standard pipeline review",
      visibleTo: ["RSM"],
    },
    {
      rank: 2,
      action: "Coordinate with Customer Success on proactive outreach to your top 20 accounts",
      lever: "Customer retention",
      owner: "You + Customer Success Lead",
      deadline: "48 hours",
      expectedImpact: "Reduce churn risk in key accounts, flag to VP Sales if accounts exceed $50K ACV",
      confidence: "MEDIUM",
      decisionRights: "Within your authority, standard retention playbook",
      visibleTo: ["RSM"],
    },
  ],
  whatWeDontKnow: {
    abstain: false,
    uncertainty:
      "Sub-segment analysis for FinServ accounts is not available at your access level. Contact your Analytics Lead for the full breakdown.",
    resolutionOwner: "Analytics Lead",
    resolutionDeadline: "5 business days",
  },
};

export const BRIEF_NEW_MARKET: AbstentionBrief = {
  kpiName: "New Market Revenue",
  persona: "CFO",
  abstain: true,
  abstentionType: "SPARSE_HISTORY",
  abstentionBanner: "NarrateIQ is not generating a root cause conclusion for this KPI",
  abstentionReason:
    "This KPI has only 6 months of history. STL decomposition requires a minimum of 24 data points to establish a reliable seasonal baseline. Running anomaly detection on fewer data points produces a false positive rate above acceptable thresholds. Generating a confident root cause explanation under these conditions would be misleading.",
  whatWeObserve:
    "Revenue has grown from $84K to $127K over 6 months, a 51% cumulative increase. The most recent month shows 4% month-on-month growth. Without a statistical baseline, this cannot be classified as an anomaly, an on-track trend, or noise. It is simply what the data shows.",
  hypothesesConsidered: [],
  resolutionPath: {
    action:
      "Continue monthly data collection for 18 additional months to establish a reliable STL baseline. In the interim, benchmark against the business case projection for this market.",
    interimAction:
      "If actuals are within plus or minus 15% of the launch projection, classify as on-track. This is a business rule, not a statistical conclusion.",
    owner: "Analytics Lead",
    timeline: "18 months for full statistical confidence. Projection benchmark available immediately.",
  },
  signal: "ABSTAIN: SPARSE HISTORY",
  generatedAt: "Today at 09:22 AM",
  totalLatency: "0.8s",
  tokenCount: 0,
  estimatedCost: "$0.000",
  feedbackCount: 0,
  note: "Zero LLM cost. Abstention was determined by deterministic logic before narrative generation was triggered.",
  processingSteps: ABSTENTION_STEPS("sparse history"),
};

export const BRIEF_RETURN_CONTRADICTORY: AbstentionBrief = {
  kpiName: "Product Return Rate",
  persona: "CFO",
  abstain: true,
  abstentionType: "CONTRADICTORY_EVIDENCE",
  abstentionBanner: "Contradictory evidence detected, analyst review required",
  abstentionReason:
    "Return rate increased 18% (anomalous, z-score 2.6). Simultaneously, customer satisfaction scores in the same segment increased 9% over the same window. These two signals cannot be explained by the same root cause. Quality-driven returns would produce falling satisfaction. NarrateIQ does not generate a root cause conclusion when evidence is internally contradictory.",
  whatWeObserve:
    "Product Return Rate moved from 6.1% to 7.2% over two weeks, a statistically significant increase. Customer satisfaction (sourced separately from NPS platform, weekly cadence) increased from 72 to 78 in the same window.",
  hypothesesConsidered: [
    {
      hypothesis: "Product quality degradation",
      status: "REJECTED",
      reason: "Satisfaction scores rising, inconsistent with quality decline.",
    },
    {
      hypothesis: "Returns policy change",
      status: "PLAUSIBLE: UNCONFIRMED",
      reason:
        "Would explain returns increase without satisfaction impact. No policy change found in system logs, requires manual verification.",
    },
    {
      hypothesis: "New customer cohort behaviour",
      status: "PLAUSIBLE: UNCONFIRMED",
      reason:
        "New customer mix increased this period. New customers typically return more. Would not affect satisfaction if product quality is sound.",
    },
  ],
  resolutionPath: {
    action:
      "Segment return data by customer cohort (new vs existing) and by product category. If new customer returns account for majority of the increase, the new-cohort hypothesis is confirmed and no quality intervention is needed.",
    owner: "Analytics Lead + Returns Operations",
    timeline: "2 business days",
  },
  signal: "ABSTAIN: CONTRADICTORY EVIDENCE",
  generatedAt: "Today at 09:31 AM",
  totalLatency: "2.1s",
  tokenCount: 0,
  estimatedCost: "$0.000",
  feedbackCount: 0,
  note: "Zero LLM cost. Abstention triggered before narrative generation.",
  processingSteps: ABSTENTION_STEPS("contradictory evidence"),
};

export function getBrief(kpiId: string, persona: Persona): Brief | AbstentionBrief | null {
  if (kpiId === "revenue") return persona === "CFO" ? BRIEF_REVENUE_CFO : BRIEF_REVENUE_RSM;
  if (kpiId === "newMarket") return BRIEF_NEW_MARKET;
  if (kpiId === "returnRate") return BRIEF_RETURN_CONTRADICTORY;
  if (kpiId === "cac") return BRIEF_CAC_CFO;
  return null;
}

export const BRIEF_CAC_CFO: Brief = {
  kpiName: "Customer Acquisition Cost",
  persona: "CFO",
  abstain: false,
  generatedAt: "Today at 09:18 AM",
  totalLatency: "1.8s",
  tokenCount: 445,
  estimatedCost: "$0.001",
  feedbackCount: 1,
  processingSteps: PROCESSING_STEPS.map((s) =>
    s.type === "LLM"
      ? { ...s, method: "LLM (Haiku tier), narration of pre-computed findings only", duration: "0.7s" }
      : s,
  ),
  whatChanged: {
    summary:
      "Customer Acquisition Cost rose from a $304 baseline to $340 per customer (+12.0%) over the last eight reporting weeks. At z = 1.8 the movement is below the anomaly threshold of 2.0 and is classified as WATCH with MEDIUM materiality, directional, sustained, but not yet statistically conclusive.",
    table: [
      {
        metric: "CAC, blended, all segments",
        period: "Last 8 weeks",
        value: "$340",
        vsBaseline: "+$36 (+12.0%)",
        zScore: "1.8σ",
        materiality: "MEDIUM",
      },
    ],
    sources: [
      {
        name: "Marketing Platform",
        cadence: "Weekly",
        freshness: "Updated 3 days ago",
        status: "current",
      },
    ],
  },
  whyItChanged: {
    summary:
      "One driver passed causal validation. A second candidate was retained as directional only because the observation window is shorter than the minimum required for the backdoor adjustment set.",
    hypotheses: [
      {
        rank: 1,
        driver: "Paid search auction price inflation",
        contributionPct: 71,
        contributionAbs: "+$26 per customer",
        confidence: "HIGH",
        confidenceScore: 0.8,
        method: "DoWhy CausalModel (backdoor criterion)",
        type: "NON-LLM",
        rejected: false,
        evidence: [
          {
            type: "SQL",
            label: "SQL analysis",
            text: "Median cost-per-click across the top 20 spend keywords rose 24% over eight weeks while conversion rate held flat at 3.1%.",
            source: "Marketing Platform Weekly",
            relevanceScore: "86%",
          },
        ],
      },
      {
        rank: 2,
        driver: "Channel mix shift toward paid",
        contributionPct: 29,
        contributionAbs: "+$10 per customer",
        confidence: "MEDIUM",
        confidenceScore: 0.55,
        method: "Waterfall mix decomposition",
        type: "NON-LLM",
        rejected: false,
        evidence: [
          {
            type: "SQL",
            label: "SQL analysis",
            text: "Organic share of new customers fell from 41% to 33%; paid share absorbed the difference at a materially higher unit cost.",
            source: "Marketing Platform Weekly",
            relevanceScore: "72%",
          },
        ],
      },
    ],
  },
  whatToDo: [
    {
      rank: 1,
      action: "Cap bids on the top 20 spend keywords and re-test at a 15% lower ceiling",
      lever: "Marketing spend efficiency",
      owner: "VP Marketing",
      deadline: "5 business days",
      expectedImpact: "Recover an estimated $18 of the $36 CAC increase without volume loss",
      confidence: "MEDIUM",
      decisionRights: "VP Marketing, within existing budget authority",
      visibleTo: ["CFO", "RSM"],
    },
  ],
  whatWeDontKnow: {
    abstain: false,
    uncertainty:
      "Whether the organic share decline is a durable channel shift or a temporary effect of the content refresh cycle cannot be determined from eight weeks of data.",
    resolutionAction: "Compare organic acquisition against the same period in the two prior years.",
    resolutionOwner: "Marketing Analytics",
    resolutionDeadline: "3 business days",
    confidenceImpact:
      "Resolving this would either promote the channel-mix driver to HIGH confidence or retire it entirely.",
  },
};

export const TELEMETRY_LOG = [
  { timestamp: "Today 09:14", kpi: "Total Revenue", persona: "CFO", model: "LLM (Sonnet)", tokens: 847, latency: 5000, cost: "$0.004" },
  { timestamp: "Today 09:01", kpi: "Total Revenue", persona: "RSM", model: "LLM (Sonnet)", tokens: 612, latency: 3800, cost: "$0.003" },
  { timestamp: "Yesterday 16:42", kpi: "Product Return Rate", persona: "CFO", model: "LLM (Sonnet)", tokens: 934, latency: 5200, cost: "$0.005" },
  { timestamp: "Yesterday 14:20", kpi: "Customer Acquisition Cost", persona: "CFO", model: "LLM (Haiku)", tokens: 445, latency: 1800, cost: "$0.001" },
  { timestamp: "Yesterday 11:05", kpi: "New Market Revenue", persona: "CFO", model: "None (abstention)", tokens: 0, latency: 820, cost: "$0.000" },
  { timestamp: "2 days ago 15:30", kpi: "Total Revenue", persona: "CFO", model: "LLM (Sonnet)", tokens: 891, latency: 5100, cost: "$0.004" },
  { timestamp: "2 days ago 10:15", kpi: "Average Order Value", persona: "RSM", model: "None (noise signal)", tokens: 0, latency: 210, cost: "$0.000" },
  { timestamp: "3 days ago 09:45", kpi: "Product Return Rate", persona: "CFO", model: "LLM (Sonnet)", tokens: 778, latency: 4700, cost: "$0.004" },
  { timestamp: "3 days ago 08:30", kpi: "Customer Acquisition Cost", persona: "CFO", model: "LLM (Haiku)", tokens: 502, latency: 2100, cost: "$0.001" },
  { timestamp: "4 days ago 17:00", kpi: "Total Revenue", persona: "CFO", model: "LLM (Sonnet)", tokens: 866, latency: 4900, cost: "$0.004" },
];

export const SEMANTIC_CONTRACT = [
  {
    id: "revenue",
    name: "Total Revenue",
    definition:
      "Recognised revenue from all completed customer transactions, net of refunds and credit notes, attributed to the closing date of the transaction.",
    formula: "SUM(transaction_value) WHERE status = 'completed' AND refunded = false",
    lineage: "CRM Daily Feed → warehouse.fct_transactions → semantic.revenue_daily",
    cadence: "Daily, 04:00 UTC",
    owner: "Group Financial Controller",
    thresholds: "Statistical: |z| ≥ 2.0 · Business: revenue at risk ≥ $250K per 21-day window",
    accessRoles: ["CFO", "RSM"],
    lastUpdated: "Today, 07:02 UTC",
  },
  {
    id: "cac",
    name: "Customer Acquisition Cost",
    definition:
      "Total sales and marketing spend in a period divided by the count of net-new customers first billed in that period.",
    formula: "SUM(marketing_spend + sales_spend) / COUNT(DISTINCT new_customer_id)",
    lineage: "Marketing Platform Weekly → warehouse.fct_spend + fct_customers → semantic.cac_weekly",
    cadence: "Weekly, Monday 06:00 UTC",
    owner: "VP Marketing Operations",
    thresholds: "Statistical: |z| ≥ 2.0 · Business: unit cost change ≥ $25 per customer",
    accessRoles: ["CFO", "RSM"],
    lastUpdated: "3 days ago, 06:04 UTC",
  },
  {
    id: "aov",
    name: "Average Order Value",
    definition: "Mean value of completed orders in the period, excluding internal and test accounts.",
    formula: "SUM(order_value) / COUNT(order_id) WHERE status = 'completed'",
    lineage: "CRM Daily Feed → warehouse.fct_orders → semantic.aov_daily",
    cadence: "Daily, 04:00 UTC",
    owner: "Group Financial Controller",
    thresholds: "Statistical: |z| ≥ 2.0 · Business: revenue at risk ≥ $100K per 21-day window",
    accessRoles: ["CFO", "RSM"],
    lastUpdated: "Today, 07:02 UTC",
  },
  {
    id: "returnRate",
    name: "Product Return Rate",
    definition:
      "Share of shipped units returned within the 30-day return window, measured against the shipment cohort rather than the return date.",
    formula: "COUNT(returned_units) / COUNT(shipped_units) BY shipment_cohort_week",
    lineage: "Operations System Weekly → warehouse.fct_returns → semantic.return_rate_weekly",
    cadence: "Weekly, Sunday 22:00 UTC",
    owner: "Director, Returns Operations",
    thresholds: "Statistical: |z| ≥ 2.0 · Business: margin at risk ≥ $75K per quarter",
    accessRoles: ["CFO"],
    lastUpdated: "1 day ago, 22:00 UTC",
  },
  {
    id: "newMarket",
    name: "New Market Revenue",
    definition:
      "Recognised revenue attributed to markets launched within the trailing 24 months, reported as a monthly rollup.",
    formula: "SUM(transaction_value) WHERE market_launch_date > NOW() - INTERVAL '24 months'",
    lineage: "CRM Monthly Rollup → warehouse.fct_transactions → semantic.new_market_monthly",
    cadence: "Monthly, 3rd business day",
    owner: "Head of Market Expansion",
    thresholds:
      "Statistical: not applicable, 6 of 24 required data points · Business: variance vs launch case ≥ ±15%",
    accessRoles: ["CFO"],
    lastUpdated: "12 days ago, 09:00 UTC",
  },
];
