import { SCENARIOS } from "@/data/narrateiq";

export function ScenarioBar({
  active,
  onSelect,
}: {
  active: string | null;
  onSelect: (id: "A" | "B" | "C" | "D") => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-secondary">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-3 px-6 py-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Demo scenarios:
        </span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SCENARIOS) as ("A" | "B" | "C" | "D")[]).map((key) => {
            const s = SCENARIOS[key];
            const isActive = active === key;
            return (
              <button
                key={key}
                onClick={() => onSelect(key)}
                title={s.description}
                className={`border px-3 py-1.5 text-left transition-colors ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary"
                }`}
              >
                <span className="block text-[11px] font-bold leading-none">{s.id}</span>
                <span className="mt-0.5 block text-[10.5px] leading-none opacity-80">{s.label}</span>
              </button>
            );
          })}
        </div>
        <span className="ml-auto text-[10px] text-muted-foreground">
          Accenture Innovation Challenge 2026
        </span>
      </div>
    </div>
  );
}
