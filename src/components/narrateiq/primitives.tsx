import type { ReactNode } from "react";

export function SignalBadge({ signal }: { signal: string }) {
  const map: Record<string, string> = {
    ANOMALY: "bg-signal-anomaly text-white",
    WATCH: "bg-signal-watch text-signal-watch-foreground",
    NOISE: "bg-muted text-muted-foreground",
    SPARSE: "bg-signal-sparse text-white",
    LOCKED: "bg-signal-locked text-white",
  };
  return (
    <span
      className={`inline-block px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.12em] ${map[signal] ?? ""}`}
    >
      {signal}
    </span>
  );
}

export function MethodBadge({ type }: { type: "NON-LLM" | "LLM" }) {
  return (
    <span
      className={`inline-block px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.1em] ${
        type === "LLM"
          ? "bg-signal-watch text-signal-watch-foreground"
          : "bg-muted text-foreground"
      }`}
    >
      {type}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: string }) {
  const map: Record<string, string> = {
    HIGH: "border-pos text-pos",
    MEDIUM: "border-signal-watch text-warn-foreground",
    REJECTED: "border-border text-muted-foreground",
    LOW: "border-border text-muted-foreground",
  };
  return (
    <span
      className={`inline-block border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.1em] ${
        map[confidence] ?? ""
      }`}
    >
      {confidence}
    </span>
  );
}

export function FreshnessDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    current: "bg-pos",
    approaching: "bg-signal-watch",
    overdue: "bg-signal-anomaly",
  };
  return (
    <span className={`inline-block h-[6px] w-[6px] rounded-full ${map[status] ?? ""}`} />
  );
}

export function SectionHeading({ index, title }: { index: string; title: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-serif text-[19px] font-semibold tracking-tight text-foreground">
        <span className="text-muted-foreground">{index} · </span>
        {title}
      </h2>
      <div className="mt-2 h-px w-full bg-border" />
    </div>
  );
}

export function Sparkline({
  data,
  color,
  dashed = false,
}: {
  data: number[];
  color: string;
  dashed?: boolean;
}) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const w = 100;
  const h = 40;
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((d - min) / span) * (h - 6) - 3;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-10 w-full"
      role="img"
      aria-label="Trend sparkline"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeDasharray={dashed ? "3 3" : undefined}
      />
    </svg>
  );
}

export const SIGNAL_STROKE: Record<string, string> = {
  ANOMALY: "var(--signal-anomaly)",
  WATCH: "var(--signal-watch-line)",
  NOISE: "var(--muted-foreground)",
  SPARSE: "var(--signal-sparse)",
  LOCKED: "var(--signal-locked)",
};

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground">
      {children}
    </span>
  );
}
