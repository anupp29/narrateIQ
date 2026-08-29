import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  KPI_DATA,
  PERSONA_LABEL,
  SCENARIOS,
  getBrief,
  type Persona,
} from "@/data/narrateiq";
import { Login } from "@/components/narrateiq/Login";
import { Dashboard } from "@/components/narrateiq/Dashboard";
import { BriefLoading } from "@/components/narrateiq/BriefLoading";
import { DecisionBrief } from "@/components/narrateiq/DecisionBrief";
import { Telemetry } from "@/components/narrateiq/Telemetry";
import { SemanticContractModal } from "@/components/narrateiq/SemanticContractModal";
import { ScenarioBar } from "@/components/narrateiq/ScenarioBar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NarrateIQ — KPI Intelligence-to-Action Engine" },
      {
        name: "description",
        content:
          "NarrateIQ detects material KPI movements, ranks causal drivers with deterministic methods, communicates uncertainty, and assigns grounded actions.",
      },
      { property: "og:title", content: "NarrateIQ — KPI Intelligence-to-Action Engine" },
      {
        property: "og:description",
        content:
          "Persona-specific decision briefs with traceable evidence, explicit abstention, and per-insight cost telemetry.",
      },
    ],
  }),
  component: NarrateIQ,
});

type View = "login" | "dashboard" | "loading" | "brief" | "telemetry";

function NarrateIQ() {
  const [view, setView] = useState<View>("login");
  const [persona, setPersona] = useState<Persona>("CFO");
  const [activeKpi, setActiveKpi] = useState<string>("revenue");
  const [scenario, setScenario] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [showContract, setShowContract] = useState(false);

  useEffect(() => {
    if (view === "brief") window.scrollTo({ top: 0 });
  }, [view, activeKpi]);

  const brief = getBrief(activeKpi, persona);

  function generate(id: string) {
    setActiveKpi(id);
    setView("loading");
  }

  function applyScenario(id: "A" | "B" | "C" | "D") {
    const s = SCENARIOS[id];
    setScenario(id);
    setPersona(s.activePersona);
    setActiveKpi(s.activeKPI);
    setShowContract(false);
    setView("brief");
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-6 py-3">
          <button
            onClick={() => view !== "login" && setView("dashboard")}
            className="font-serif text-[17px] font-bold tracking-tight text-foreground"
          >
            NarrateIQ
          </button>
          <span className="h-4 w-px bg-border" />
          <span className="hidden text-[12px] text-muted-foreground sm:inline">
            KPI Intelligence-to-Action Engine
          </span>
          {view !== "login" && (
            <div className="ml-auto flex items-center gap-3">
              <span className="border border-border bg-secondary px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
                {PERSONA_LABEL[persona]}
              </span>
              <button
                onClick={() => setView("login")}
                className="text-[12px] text-primary underline underline-offset-2"
              >
                Switch persona
              </button>
            </div>
          )}
        </div>
      </header>

      <main>
        {view === "login" && (
          <Login
            initialPersona={persona}
            onSignIn={(p) => {
              setPersona(p);
              setView("dashboard");
            }}
          />
        )}

        {view === "dashboard" && <Dashboard persona={persona} onGenerate={generate} />}

        {view === "loading" && brief && (
          <BriefLoading
            kpiName={KPI_DATA[activeKpi]?.name ?? brief.kpiName}
            steps={brief.processingSteps}
            onComplete={() => setView("brief")}
          />
        )}

        {view === "brief" &&
          (brief ? (
            <DecisionBrief brief={brief} onBack={() => setView("dashboard")} />
          ) : (
            <div className="mx-auto max-w-[760px] px-6 py-16 text-center text-[13px] text-muted-foreground">
              No brief available for this KPI.
            </div>
          ))}

        {view === "telemetry" && (
          <Telemetry persona={persona} onBack={() => setView("dashboard")} />
        )}
      </main>

      {view !== "login" && (
        <footer className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-4 border-t border-border px-6 py-4 text-[12px]">
          <button
            onClick={() => setView("telemetry")}
            className="text-primary underline underline-offset-2"
          >
            System telemetry →
          </button>
          <button
            onClick={() => setShowContract(true)}
            className="text-primary underline underline-offset-2"
          >
            KPI definitions →
          </button>
          <span className="ml-auto text-muted-foreground">
            All inference calls are logged and costed. Role-based entitlements enforced.
          </span>
        </footer>
      )}

      {showContract && <SemanticContractModal onClose={() => setShowContract(false)} />}

      <ScenarioBar active={scenario} onSelect={applyScenario} />
    </div>
  );
}
