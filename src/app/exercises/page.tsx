"use client";
import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import BreathingOrb from "@/components/BreathingOrb";
import { EXERCISES, CATEGORIES, Exercise } from "@/lib/exercises";

export default function ExercisesPage() {
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
  const [active, setActive] = useState<Exercise | null>(null);

  if (active) {
    return (
      <>
        <Header title={active.title} subtitle={`${active.category} · ${active.minutes} min`} />
        <div className="space-y-3 px-1">
          <button onClick={() => setActive(null)} className="btn-ghost px-0 text-sm">← All exercises</button>
          <div className="card">
            <p className="text-sm text-ink/80">{active.intro}</p>
            <ol className="mt-3 space-y-2">
              {active.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">{i + 1}</span>
                  <span className="text-ink/85">{s}</span>
                </li>
              ))}
            </ol>
            {active.breathing && <div className="mt-5 flex justify-center"><BreathingOrb /></div>}
            {active.id === "thought-reframe" && (
              <Link href="/program" className="btn-primary mt-4 inline-block w-full text-center">Open guided thought record</Link>
            )}
          </div>
        </div>
      </>
    );
  }

  const list = cat === "All" ? EXERCISES : EXERCISES.filter((e) => e.category === cat);

  return (
    <>
      <Header title="Exercises" subtitle="Simple practices for a better mind." />
      <div className="space-y-3 px-1">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={`chip ${cat === c ? "border-transparent bg-gradient-to-r from-[#F2A65A] to-[#E27D6E] text-white" : ""}`}>
              {c}
            </button>
          ))}
        </div>

        {list.map((e) => (
          <button key={e.id} onClick={() => setActive(e)} className="card flex w-full items-center gap-3 text-left transition hover:brightness-110">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-xl">{e.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{e.title}</span>
              <span className="block text-sm text-muted">{e.minutes} min · {e.category}</span>
            </span>
            <span className="text-muted">›</span>
          </button>
        ))}
      </div>
    </>
  );
}
