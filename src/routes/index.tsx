import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BriefLoading } from "@/components/narrateiq/BriefLoading";
import { Dashboard } from "@/components/narrateiq/Dashboard";
import { DecisionBrief } from "@/components/narrateiq/DecisionBrief";
import { Login } from "@/components/narrateiq/Login";
import { ScenarioBar } from "@/components/narrateiq/ScenarioBar";
import { SemanticContractModal } from "@/components/narrateiq/SemanticContractModal";
import { Telemetry } from "@/components/narrateiq/Telemetry";
import { narrationPayload, runBrief } from "@/engine/pipeline";
import { PERSONA_LABEL, type Persona } from "@/engine/rbac";
import { SCENARIOS, type Scenario } from "@/engine/scenarios";
import { narrateBrief, type NarrationResult } from "@/lib/narrate.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NarrateIQ: KPI Intelligence to Action Engine" },
      {
        name: "description",
        content:
          "NarrateIQ detects material KPI movements, ranks causal drivers with deterministic methods, abstains when evidence is insufficient, and assigns owned actions with monitoring plans.",
      },
      { property: "og:title", content: "NarrateIQ: KPI Intelligence to Action Engine" },
      {
        property: "og:description",
        content:
          "Persona specific decision briefs computed from source extracts, with refutation tested drivers, explicit abstention and per insight cost telemetry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NarrateIQ,
});

type View = "login" | "dashboard" | "loading" | "brief" | "telemetry";

function NarrateIQ() {
  const [view, setView] = useState<View>("login");
  const [persona, setPersona] = useState<Persona>("CFO");
  const [activeKpi, setActiveKpi] = useState("revenue");
  const [scenario, setScenario] = useState<Scenario["id"] | null>(null);
  const [showContract, setShowContract] = useState(false);
  const [runToken, setRunToken] = useState(0);
  const [narration, setNarration] = useState<NarrationResult | null>(null);
  const [narrating, setNarrating] = useState(false);

  const narrate = useServerFn(narrateBrief);

  const brief = useMemo(() => {
    void runToken;
    try {
      return runBrief(activeKpi, persona);
    } catch {
      return null;
    }
  }, [activeKpi, persona, runToken]);

  useEffect(() => {
    if (view === "brief") window.scrollTo({ top: 0 });
  }, [view, activeKpi]);

  useEffect(() => {
    setNarration(null);
    if (!brief || view === "login" || view === "dashboard") return;
    let cancelled = false;
    setNarrating(true);
    narrate({ data: narrationPayload(brief) })
      .then((result) => {
        if (!cancelled) setNarration(result);
      })
      .catch(() => {
        if (!cancelled) setNarration(null);
      })
      .finally(() => {
        if (!cancelled) setNarrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brief, view, narrate]);

  const generate = useCallback((id: string) => {
    setActiveKpi(id);
    setView("loading");
  }, []);

  const applyScenario = useCallback((id: Scenario["id"]) => {
    const s = SCENARIOS[id];
    setScenario(id);
    setPersona(s.persona);
    setActiveKpi(s.kpiId);
    setShowContract(false);
    setView("brief");
    window.scrollTo({ top: 0 });
  }, []);

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
            KPI intelligence to action engine
          </span>
          {view !== "login" && (
            <div className="ml-auto flex items-center gap-3">
              <span className="border border-border bg-secondary px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
                {PERSONA_LABEL[persona]}
              </span>
              <button onClick={() => setView("login")} className="text-[12px] text-primary underline underline-offset-2">
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
          <BriefLoading kpiName={brief.kpiName} steps={brief.steps} onComplete={() => setView("brief")} />
        )}

        {view === "brief" &&
          (brief ? (
            <DecisionBrief
              brief={brief}
              narration={narration}
              narrating={narrating}
              onBack={() => setView("dashboard")}
              onRefresh={() => setRunToken((t) => t + 1)}
              onClarify={() => setRunToken((t) => t + 1)}
            />
          ) : (
            <div className="mx-auto max-w-[760px] px-6 py-16 text-center text-[13px] text-muted-foreground">
              This KPI is not available for the selected persona.
            </div>
          ))}

        {view === "telemetry" && <Telemetry persona={persona} onBack={() => setView("dashboard")} />}
      </main>

      {view !== "login" && (
        <footer className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-4 border-t border-border px-6 py-4 text-[12px]">
          <button onClick={() => setView("telemetry")} className="text-primary underline underline-offset-2">
            System telemetry
          </button>
          <button onClick={() => setShowContract(true)} className="text-primary underline underline-offset-2">
            KPI definitions
          </button>
          <span className="ml-auto text-muted-foreground">
            Entitlements enforced before data is read. Every inference call is logged and costed.
          </span>
        </footer>
      )}

      {showContract && <SemanticContractModal onClose={() => setShowContract(false)} />}

      <ScenarioBar active={scenario} onSelect={applyScenario} />
    </div>
  );
}
