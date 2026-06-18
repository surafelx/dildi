"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import CrisisLockout from "@/components/CrisisLockout";

/**
 * Emoji mood check-in ("How are you feeling today?"). Maps a feeling to the
 * numeric mood model so it feeds insights and the Bridge. A note is optional.
 */
const FEELINGS = [
  { id: "amazing", label: "Amazing", icon: "🤩", mood: 10, anxiety: 2, energy: 9 },
  { id: "good", label: "Good", icon: "🙂", mood: 8, anxiety: 3, energy: 7 },
  { id: "okay", label: "Okay", icon: "😐", mood: 6, anxiety: 4, energy: 5 },
  { id: "anxious", label: "Anxious", icon: "😬", mood: 4, anxiety: 8, energy: 5 },
  { id: "sad", label: "Sad", icon: "😢", mood: 3, anxiety: 5, energy: 3 },
  { id: "overwhelmed", label: "Overwhelmed", icon: "😵", mood: 2, anxiety: 9, energy: 3 },
];

export default function CheckinPage() {
  const router = useRouter();
  const [sel, setSel] = useState<(typeof FEELINGS)[number] | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);

  async function save() {
    if (!sel) return;
    setSaving(true);
    const res = await fetch("/api/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mood: sel.mood, anxiety: sel.anxiety, energy: sel.energy,
        sleepQuality: 5, sleepHours: 7,
      }),
    });
    // Optional note → save as a short journal line (encrypted, crisis-screened).
    if (res.ok && note.trim()) {
      const j = await fetch("/api/journal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: note, moodTags: [sel.id] }),
      });
      if (j.status === 423) { setLocked(true); setSaving(false); return; }
    }
    setSaving(false);
    if (res.ok) router.push("/");
  }

  if (locked) return <CrisisLockout onResolve={() => router.push("/")} />;

  return (
    <div className="px-1">
      <button onClick={() => router.push("/")} className="btn-ghost px-0 text-sm">✕ Close</button>
      <h1 className="serif mt-2 text-3xl font-semibold leading-tight">How are you<br />feeling today?</h1>
      <p className="mt-1 text-sm text-muted">It&apos;s okay to feel however you feel.</p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {FEELINGS.map((f) => (
          <button key={f.id} onClick={() => setSel(f)}
            className={`card flex flex-col items-center gap-2 py-5 transition ${sel?.id === f.id ? "ring-2 ring-[#E27D6E] brightness-110" : "hover:brightness-110"}`}>
            <span className="text-3xl">{f.icon}</span>
            <span className="text-sm font-medium">{f.label}</span>
          </button>
        ))}
      </div>

      <textarea className="input mt-4 min-h-[90px]" placeholder="Want to add a note? (optional)"
        value={note} onChange={(e) => setNote(e.target.value)} />

      <button onClick={save} disabled={!sel || saving} className="btn-primary mt-4 w-full">
        {saving ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}
