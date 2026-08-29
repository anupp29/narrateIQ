import { useState } from "react";
import type { Persona } from "@/data/narrateiq";

const PERSONAS: { id: Persona; title: string; desc: string }[] = [
  {
    id: "CFO",
    title: "Chief Financial Officer",
    desc: "Strategic overview · Full data access · Board-level actions.",
  },
  {
    id: "RSM",
    title: "Regional Sales Manager",
    desc: "Regional view · Operational actions · Restricted financial data.",
  },
];

export function Login({
  initialPersona,
  onSignIn,
}: {
  initialPersona: Persona;
  onSignIn: (persona: Persona) => void;
}) {
  const [persona, setPersona] = useState<Persona>(initialPersona);
  const [email, setEmail] = useState("a.patil@enterprise.com");
  const [password, setPassword] = useState("demo1234");

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-secondary px-4 py-16">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSignIn(persona);
        }}
        className="w-full max-w-[420px] border border-border bg-card p-8"
      >
        <h1 className="font-serif text-[26px] font-bold tracking-tight text-foreground">NarrateIQ</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">KPI Intelligence-to-Action Engine</p>
        <div className="my-5 h-px w-full bg-border" />

        <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Email
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          className="mt-1.5 w-full border border-input bg-background px-3 py-2 text-[14px] outline-none focus:border-primary"
        />

        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Password
        </label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          className="mt-1.5 w-full border border-input bg-background px-3 py-2 text-[14px] outline-none focus:border-primary"
        />

        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Select persona
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {PERSONAS.map((p) => {
            const active = persona === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPersona(p.id)}
                className={`border border-l-[3px] p-3 text-left transition-colors ${
                  active
                    ? "border-border border-l-primary bg-primary/5"
                    : "border-border border-l-border bg-secondary/60 opacity-60 hover:opacity-90"
                }`}
              >
                <span className="block text-[12px] font-semibold leading-tight text-foreground">
                  {p.title}
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                  {p.desc}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="submit"
          className="mt-6 w-full bg-primary px-4 py-2.5 text-[13px] font-semibold tracking-wide text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Sign in
        </button>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Role-based data entitlements apply. All access is logged.
        </p>
      </form>
    </div>
  );
}
