"use client";
import { api } from "@/lib/api";
import { useState } from "react";
import { useRouter } from "next/navigation";
import CrisisLockout from "@/components/CrisisLockout";

/**
 * Daily check-in — one dimension at a time, each rated by tapping an emoji
 * "level". Maps onto the numeric mood model (1–10, sleepHours in hours) so it
 * feeds Insights and the Bridge.
 */
type Step = {
  key: "mood" | "anxiety" | "energy" | "sleepQuality" | "sleepHours";
  q: string;
  opts: { e: string; v: number; l: string }[];
};

const STEPS: Step[] = [
  { key: "mood", q: "How's your mood?", opts: [
    { e: "😣", v: 2, l: "Low" }, { e: "😕", v: 4, l: "Meh" }, { e: "😐", v: 6, l: "Okay" }, { e: "🙂", v: 8, l: "Good" }, { e: "😄", v: 10, l: "Great" } ] },
  { key: "anxiety", q: "How anxious do you feel?", opts: [
    { e: "😌", v: 2, l: "Calm" }, { e: "🙂", v: 4, l: "Settled" }, { e: "😐", v: 6, l: "Some" }, { e: "😟", v: 8, l: "High" }, { e: "😰", v: 10, l: "Intense" } ] },
  { key: "energy", q: "How's your energy?", opts: [
    { e: "🪫", v: 2, l: "Drained" }, { e: "😪", v: 4, l: "Low" }, { e: "😐", v: 6, l: "Okay" }, { e: "🙂", v: 8, l: "Good" }, { e: "⚡", v: 10, l: "Lively" } ] },
  { key: "sleepQuality", q: "How well did you sleep?", opts: [
    { e: "😵", v: 2, l: "Badly" }, { e: "😕", v: 4, l: "Restless" }, { e: "😐", v: 6, l: "Okay" }, { e: "🙂", v: 8, l: "Well" }, { e: "🌙", v: 10, l: "Deeply" } ] },
  { key: "sleepHours", q: "How many hours did you sleep?", opts: [
    { e: "😩", v: 4, l: "≤4h" }, { e: "😬", v: 5, l: "5h" }, { e: "😐", v: 6, l: "6h" }, { e: "🙂", v: 7, l: "7h" }, { e: "😌", v: 8, l: "8h" }, { e: "😴", v: 9, l: "9h+" } ] },
];

export default function CheckinPage() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [vals, setVals] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);

  const onNote = i === STEPS.length; // final step

  function pick(v: number) {
    const step = STEPS[i];
    setVals((prev) => ({ ...prev, [step.key]: v }));
    setI(i + 1); // advance one by one
  }

  async function save() {
    setSaving(true);
    const res = await api("/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mood: vals.mood ?? 6, anxiety: vals.anxiety ?? 6, energy: vals.energy ?? 6,
        sleepQuality: vals.sleepQuality ?? 6, sleepHours: vals.sleepHours ?? 7,
      }),
    });
    if (res.ok && note.trim()) {
      const j = await api("/journal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: note, moodTags: ["check-in"] }),
      });
      if (j.status === 423) { setLocked(true); setSaving(false); return; }
    }
    setSaving(false);
    if (res.ok) router.push("/");
  }

  if (locked) return <CrisisLockout onResolve={() => router.push("/")} />;

  return (
    <div className="px-1">
      {/* progress */}
      <div className="mb-5 flex gap-1.5">
        {STEPS.map((_, idx) => (
          <span key={idx} className={`h-1.5 flex-1 rounded-full ${idx < i ? "bg-gradient-to-r from-[#F2A65A] to-[#E27D6E]" : "bg-white/15"}`} />
        ))}
      </div>

      <button onClick={() => (i === 0 ? router.push("/") : setI(i - 1))} className="btn-ghost px-0 text-sm">
        {i === 0 ? "✕ Close" : "← Back"}
      </button>

      {!onNote ? (
        <div className="rise">
          <p className="text-sm text-muted">Step {i + 1} of {STEPS.length}</p>
          <h1 className="serif mt-1 text-3xl font-semibold leading-tight">{STEPS[i].q}</h1>
          <p className="mt-1 text-sm text-muted">Tap how it feels.</p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {STEPS[i].opts.map((o) => {
              const active = vals[STEPS[i].key] === o.v;
              return (
                <button key={o.v} onClick={() => pick(o.v)}
                  className={`card flex flex-col items-center gap-2 py-5 transition hover:brightness-110 ${active ? "ring-2 ring-[#E27D6E]" : ""}`}>
                  <span className="text-4xl">{o.e}</span>
                  <span className="text-sm font-medium">{o.l}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rise">
          <h1 className="serif mt-1 text-3xl font-semibold leading-tight">Anything to note?</h1>
          <p className="mt-1 text-sm text-muted">Optional — a line about your day. Encrypted, just for you.</p>
          <textarea className="input mt-4 min-h-[110px]" placeholder="Today I…"
            value={note} onChange={(e) => setNote(e.target.value)} />
          <button onClick={save} disabled={saving} className="btn-primary mt-4 w-full">
            {saving ? "Saving…" : "Finish check-in"}
          </button>
        </div>
      )}
    </div>
  );
}
