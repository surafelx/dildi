"use client";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import ThoughtRecord from "@/components/ThoughtRecord";
import BreathingOrb from "@/components/BreathingOrb";
import { CBT_PROGRAM, CbtModule } from "@/lib/cbt-program";

type View = "list" | "module" | "record";

export default function ProgramPage() {
  const [completed, setCompleted] = useState<string[]>([]);
  const [view, setView] = useState<View>("list");
  const [active, setActive] = useState<CbtModule | null>(null);

  async function loadProgress() {
    const r = await api("/program").then((x) => x.json()).catch(() => ({ completedModules: [] }));
    setCompleted(r.completedModules ?? []);
  }
  useEffect(() => { loadProgress(); }, []);

  async function markComplete(moduleId: string) {
    const r = await api("/program", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId, completed: true }),
    }).then((x) => x.json());
    setCompleted(r.completedModules ?? []);
  }

  const doneCount = completed.length;
  const total = CBT_PROGRAM.length;

  // ── curriculum list ──
  if (view === "list") {
    return (
      <>
        <Header title="CBT Program" subtitle={`A gentle 6-step course · ${doneCount}/${total} complete`} />
        <div className="space-y-3 px-1">
          <div className="card bg-gradient-to-br from-primary/10 to-accent/10">
            <p className="text-sm text-ink/80">
              Learn the core skills of Cognitive Behavioral Therapy, one small step at a time.
              This is self-guided support — not a replacement for a therapist. If things feel
              heavy, reaching out to a person is a strong, healthy step.
            </p>
          </div>

          {CBT_PROGRAM.map((m) => {
            const done = completed.includes(m.id);
            return (
              <button key={m.id} onClick={() => { setActive(m); setView("module"); }}
                className="card flex w-full items-center gap-3 text-left transition hover:bg-white/85">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done ? "bg-primary text-white" : "bg-white/10 text-muted"}`}>
                  {done ? "✓" : m.week}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{m.title}</span>
                  <span className="block truncate text-sm text-muted">{m.subtitle} · {m.minutes} min</span>
                </span>
                <span className="text-muted">›</span>
              </button>
            );
          })}
        </div>
      </>
    );
  }

  // ── thought-record exercise ──
  if (view === "record" && active) {
    return (
      <>
        <Header title="Thought record" subtitle={active.title} />
        <div className="card px-1">
          <ThoughtRecord
            moduleId={active.id}
            onDone={() => { markComplete(active.id); setView("module"); }}
            onCancel={() => setView("module")}
          />
        </div>
      </>
    );
  }

  // ── module / lesson ──
  if (view === "module" && active) {
    const done = completed.includes(active.id);
    return (
      <>
        <Header title={active.title} subtitle={`Week ${active.week} · ${active.subtitle}`} />
        <div className="space-y-3 px-1">
          <button onClick={() => setView("list")} className="btn-ghost px-0 text-sm">← All modules</button>

          <div className="card space-y-3">
            {active.learn.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-ink/85">{p}</p>
            ))}
          </div>

          <div className="card bg-gradient-to-br from-primary/10 to-accent/10">
            <h3 className="font-semibold">Practice</h3>
            <p className="mt-1 text-sm text-ink/80">{active.practicePrompt}</p>

            {active.practiceType === "thought_record" && (
              <button onClick={() => setView("record")} className="btn-primary mt-3 w-full">Start guided thought record</button>
            )}
            {active.practiceType === "breathing" && (
              <div className="mt-4 flex justify-center"><BreathingOrb /></div>
            )}
            {active.practiceType === "activation" && (
              <a href="/" className="btn-primary mt-3 inline-block w-full text-center">Log an activity on Home</a>
            )}
            {active.practiceType === "reflection" && (
              <p className="mt-3 text-xs text-muted">Sit with the prompt, or write it in your Journal.</p>
            )}
          </div>

          <button onClick={() => { markComplete(active.id); setView("list"); }}
            className={`w-full rounded-2xl px-5 py-3 font-semibold transition ${done ? "bg-white/10 text-muted" : "bg-primary text-white hover:brightness-105"}`}>
            {done ? "Completed ✓ — revisit anytime" : "Mark this module complete"}
          </button>
        </div>
      </>
    );
  }

  return null;
}
