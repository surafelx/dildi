"use client";
import { useState } from "react";

const SLIDERS = [
  { key: "mood", label: "Mood", low: "Low", high: "Great", min: 1, max: 10 },
  { key: "anxiety", label: "Anxiety", low: "Calm", high: "High", min: 1, max: 10 },
  { key: "energy", label: "Energy", low: "Drained", high: "Energized", min: 1, max: 10 },
  { key: "sleepQuality", label: "Sleep quality", low: "Poor", high: "Restful", min: 1, max: 10 },
] as const;

type Vals = { mood: number; anxiety: number; energy: number; sleepQuality: number; sleepHours: number };

export default function MoodCheckIn({ onSaved }: { onSaved?: () => void }) {
  const [v, setV] = useState<Vals>({
    mood: 5, anxiety: 5, energy: 5, sleepQuality: 5, sleepHours: 7,
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    setSaving(false);
    if (res.ok) {
      setDone(true);
      onSaved?.();
      setTimeout(() => setDone(false), 2500);
    }
  }

  return (
    <div className="card">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Today&apos;s check-in</h2>
        <span className="text-xs text-muted">~30 seconds</span>
      </div>

      <div className="mt-3 space-y-4">
        {SLIDERS.map((s) => (
          <div key={s.key}>
            <div className="flex items-center justify-between">
              <span className="label">{s.label}</span>
              <span className="text-sm font-semibold text-primary">
                {(v as any)[s.key]}
              </span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              value={(v as any)[s.key]}
              onChange={(e) => setV({ ...v, [s.key]: Number(e.target.value) })}
              className="mt-1 w-full accent-primary"
            />
            <div className="flex justify-between text-[11px] text-muted">
              <span>{s.low}</span>
              <span>{s.high}</span>
            </div>
          </div>
        ))}

        <div>
          <div className="flex items-center justify-between">
            <span className="label">Sleep hours</span>
            <span className="text-sm font-semibold text-primary">{v.sleepHours}h</span>
          </div>
          <input
            type="range" min={0} max={14} step={0.5}
            value={v.sleepHours}
            onChange={(e) => setV({ ...v, sleepHours: Number(e.target.value) })}
            className="mt-1 w-full accent-accent"
          />
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn-primary mt-5 w-full">
        {done ? "Saved ✓" : saving ? "Saving…" : "Save check-in"}
      </button>
    </div>
  );
}
