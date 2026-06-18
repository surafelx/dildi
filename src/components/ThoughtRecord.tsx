"use client";
import { useState } from "react";
import { DISTORTIONS } from "@/lib/cbt-program";
import CrisisLockout from "./CrisisLockout";

/**
 * Guided CBT thought record — one step at a time, so it feels gentle, not like
 * filling a form. Saves encrypted via /api/thought-records (crisis-screened).
 */
type Data = {
  situation: string;
  emotion: string;
  intensityBefore: number;
  automaticThought: string;
  distortions: string[];
  evidenceFor: string;
  evidenceAgainst: string;
  balancedThought: string;
  intensityAfter: number;
};

const EMPTY: Data = {
  situation: "", emotion: "", intensityBefore: 50, automaticThought: "",
  distortions: [], evidenceFor: "", evidenceAgainst: "", balancedThought: "", intensityAfter: 50,
};

export default function ThoughtRecord({
  moduleId, onDone, onCancel,
}: {
  moduleId?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Data>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const set = (p: Partial<Data>) => setD({ ...d, ...p });

  const steps = [
    {
      title: "The situation",
      hint: "What happened? Just the facts — where, when, who.",
      body: (
        <textarea className="input min-h-[110px]" autoFocus value={d.situation}
          onChange={(e) => set({ situation: e.target.value })}
          placeholder="e.g. My friend didn't reply to my message all day." />
      ),
      valid: d.situation.trim().length > 0,
    },
    {
      title: "The feeling",
      hint: "Name the main emotion and how strong it was.",
      body: (
        <>
          <input className="input" value={d.emotion} onChange={(e) => set({ emotion: e.target.value })}
            placeholder="e.g. anxious, hurt, ashamed" />
          <div className="mt-4">
            <div className="flex justify-between text-sm"><span className="label">Intensity</span><span className="font-semibold text-primary">{d.intensityBefore}</span></div>
            <input type="range" min={0} max={100} value={d.intensityBefore}
              onChange={(e) => set({ intensityBefore: Number(e.target.value) })} className="mt-1 w-full" />
          </div>
        </>
      ),
      valid: true,
    },
    {
      title: "The automatic thought",
      hint: "What went through your mind in that moment? The 'hot' thought.",
      body: (
        <textarea className="input min-h-[110px]" autoFocus value={d.automaticThought}
          onChange={(e) => set({ automaticThought: e.target.value })}
          placeholder="e.g. They're ignoring me. I always push people away." />
      ),
      valid: d.automaticThought.trim().length > 0,
    },
    {
      title: "Any thinking traps?",
      hint: "Tap any that might be at play. (Optional — everyone has these.)",
      body: (
        <div className="flex flex-wrap gap-1.5">
          {DISTORTIONS.map((t) => {
            const on = d.distortions.includes(t.id);
            return (
              <button key={t.id} type="button" title={t.desc}
                onClick={() => set({ distortions: on ? d.distortions.filter((x) => x !== t.id) : [...d.distortions, t.id] })}
                className={`chip text-xs ${on ? "border-primary bg-primary text-white" : ""}`}>
                {t.label}
              </button>
            );
          })}
        </div>
      ),
      valid: true,
    },
    {
      title: "Evidence it's true",
      hint: "What genuinely supports this thought?",
      body: (
        <textarea className="input min-h-[100px]" autoFocus value={d.evidenceFor}
          onChange={(e) => set({ evidenceFor: e.target.value })} placeholder="Be fair and honest." />
      ),
      valid: true,
    },
    {
      title: "Evidence against it",
      hint: "What doesn't fit? What would you tell a friend with this thought?",
      body: (
        <textarea className="input min-h-[100px]" autoFocus value={d.evidenceAgainst}
          onChange={(e) => set({ evidenceAgainst: e.target.value })} placeholder="Look for what the thought leaves out." />
      ),
      valid: true,
    },
    {
      title: "A balanced thought",
      hint: "Given all the evidence, what's a fairer, kinder way to see it?",
      body: (
        <textarea className="input min-h-[110px]" autoFocus value={d.balancedThought}
          onChange={(e) => set({ balancedThought: e.target.value })}
          placeholder="e.g. They're probably busy. One quiet day doesn't define our friendship." />
      ),
      valid: true,
    },
    {
      title: "How strong is the feeling now?",
      hint: "Re-rate the same emotion. It's okay if it only softened a little.",
      body: (
        <div>
          <div className="flex justify-between text-sm"><span className="label">Intensity now</span><span className="font-semibold text-primary">{d.intensityAfter}</span></div>
          <input type="range" min={0} max={100} value={d.intensityAfter}
            onChange={(e) => set({ intensityAfter: Number(e.target.value) })} className="mt-1 w-full" />
          <p className="mt-3 text-sm text-muted">Before it was {d.intensityBefore}. {d.intensityAfter < d.intensityBefore ? "That's real movement. 🌿" : "That's okay — naming it is the work."}</p>
        </div>
      ),
      valid: true,
    },
  ];

  const cur = steps[step];
  const isLast = step === steps.length - 1;

  async function save() {
    setSaving(true);
    const res = await fetch("/api/thought-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moduleId,
        situation: d.situation,
        emotion: d.emotion || undefined,
        intensityBefore: d.intensityBefore,
        automaticThought: d.automaticThought,
        distortions: d.distortions,
        evidenceFor: d.evidenceFor || undefined,
        evidenceAgainst: d.evidenceAgainst || undefined,
        balancedThought: d.balancedThought || undefined,
        intensityAfter: d.intensityAfter,
      }),
    });
    setSaving(false);
    if (res.status === 423) { setLocked(true); return; }
    if (res.ok) onDone();
  }

  if (locked) return <CrisisLockout onResolve={onCancel} />;

  return (
    <div>
      {/* progress */}
      <div className="mb-4 flex gap-1">
        {steps.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-black/10"}`} />
        ))}
      </div>

      <p className="text-xs font-medium text-primary">Step {step + 1} of {steps.length}</p>
      <h3 className="serif mt-1 text-xl font-semibold">{cur.title}</h3>
      <p className="mb-3 mt-0.5 text-sm text-muted">{cur.hint}</p>

      <div>{cur.body}</div>

      <div className="mt-5 flex items-center justify-between">
        <button onClick={step === 0 ? onCancel : () => setStep(step - 1)} className="btn-ghost text-sm">
          {step === 0 ? "Cancel" : "← Back"}
        </button>
        {isLast ? (
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save & finish"}</button>
        ) : (
          <button onClick={() => setStep(step + 1)} disabled={!cur.valid} className="btn-primary">Continue</button>
        )}
      </div>
    </div>
  );
}
