"use client";
import { useEffect, useState } from "react";

/**
 * A box-breathing guide: in (4s) → hold (4s) → out (4s) → rest (2s).
 * The orb scales with the breath; the label cycles with the phase.
 * A small, immediate moment of calm before anyone signs up.
 */
const PHASES = [
  { label: "Breathe in", dur: 4000, scale: 1.18 },
  { label: "Hold", dur: 4000, scale: 1.18 },
  { label: "Breathe out", dur: 4000, scale: 0.82 },
  { label: "Rest", dur: 2000, scale: 0.82 },
] as const;

export default function BreathingOrb() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setI((p) => (p + 1) % PHASES.length), PHASES[i].dur);
    return () => clearTimeout(t);
  }, [i]);

  const phase = PHASES[i];

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative flex h-52 w-52 items-center justify-center">
        <span className="breathe-ring absolute inset-0 rounded-full bg-primary/20" />
        <span
          className="absolute inset-6 rounded-full bg-gradient-to-br from-primary/30 via-secondary/25 to-accent/30 blur-xl"
          style={{ transform: `scale(${phase.scale})`, transition: `transform ${phase.dur}ms ease-in-out` }}
        />
        <span
          className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-[#F2A65A] to-[#E27D6E] text-center text-sm font-semibold text-white shadow-soft"
          style={{ transform: `scale(${phase.scale})`, transition: `transform ${phase.dur}ms ease-in-out` }}
        >
          {phase.label}
        </span>
      </div>
      <p className="text-sm text-muted">Follow the orb for a few rounds. You&apos;re already here — that counts.</p>
    </div>
  );
}
