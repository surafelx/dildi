"use client";
import { useState } from "react";

const ACTIVITIES = [
  { type: "EXERCISE", label: "Exercise", icon: "🏃" },
  { type: "MEDITATION", label: "Meditation", icon: "🧘" },
  { type: "SOCIAL", label: "Social", icon: "👋" },
  { type: "THERAPY", label: "Therapy", icon: "🛋️" },
  { type: "OTHER", label: "Other", icon: "✨" },
] as const;

export default function ActivityLogger({ onLogged }: { onLogged?: () => void }) {
  const [flash, setFlash] = useState<string | null>(null);

  async function log(type: string) {
    setFlash(type);
    await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    onLogged?.();
    setTimeout(() => setFlash(null), 900);
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold">Log an activity</h2>
      <p className="label mt-0.5">One tap — no detail required</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ACTIVITIES.map((a) => (
          <button
            key={a.type}
            onClick={() => log(a.type)}
            className={`flex flex-col items-center gap-1 rounded-xl border border-black/5 py-3 text-sm transition ${
              flash === a.type ? "bg-primary text-white" : "bg-white/10 hover:bg-white/20"
            }`}
          >
            <span className="text-xl">{a.icon}</span>
            {flash === a.type ? "Logged ✓" : a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
