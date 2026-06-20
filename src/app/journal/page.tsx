"use client";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import CrisisLockout from "@/components/CrisisLockout";

interface Entry {
  id: string; date: string; title: string | null; body: string;
  moodTags: string[]; createdAt: string;
}

const TAGS = ["grateful", "anxious", "hopeful", "tired", "angry", "calm", "lonely", "proud"];

export default function JournalPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);

  async function load() {
    const r = await api("/journal");
    if (r.ok) setEntries((await r.json()).entries ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!body.trim()) return;
    setSaving(true);
    const res = await api("/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title || undefined, body, moodTags: tags }),
    });
    setSaving(false);
    if (res.status === 423) { setLocked(true); return; }
    if (res.ok) { setTitle(""); setBody(""); setTags([]); load(); }
  }

  if (locked) return <CrisisLockout onResolve={() => setLocked(false)} />;

  return (
    <>
      <Header title="Journal" subtitle="Encrypted end-to-end. Only you can read this." />
      <div className="space-y-4 px-1">
        <div className="card">
          <input
            className="input mb-2"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="input min-h-[140px] resize-y"
            placeholder="What's on your mind?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TAGS.map((t) => (
              <button
                key={t}
                onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
                className={`chip ${tags.includes(t) ? "bg-primary text-white border-primary" : ""}`}
              >
                {t}
              </button>
            ))}
          </div>
          <button onClick={save} disabled={saving || !body.trim()} className="btn-primary mt-4 w-full">
            {saving ? "Encrypting & saving…" : "Save entry"}
          </button>
        </div>

        <div className="space-y-3">
          {entries.map((e) => (
            <article key={e.id} className="card">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">{e.title || "Untitled"}</h3>
                <time className="text-xs text-muted">
                  {new Date(e.date).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
                </time>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink/85">{e.body}</p>
              {e.moodTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {e.moodTags.map((t) => <span key={t} className="chip text-xs">{t}</span>)}
                </div>
              )}
            </article>
          ))}
          {entries.length === 0 && (
            <p className="px-1 text-sm text-muted">Your journal is empty. The first page is the hardest.</p>
          )}
        </div>
      </div>
    </>
  );
}
