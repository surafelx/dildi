"use client";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useAuth } from "@/components/AuthProvider";

interface Settings {
  name: string | null; email: string;
  biometricEnabled: boolean; inactivityLockSeconds: number; allowAiTraining: boolean;
  companionPersonality: string | null;
  emergencyContactName: string | null; emergencyContactPhone: string | null; emergencyContactTelegram: string | null;
}

// Mirrors lib/llm PERSONALITIES (kept here so the client bundle stays server-free).
const PERSONAS = [
  { id: "warm", label: "Warm", emoji: "🤗", desc: "Gentle, nurturing" },
  { id: "direct", label: "Direct", emoji: "🎯", desc: "Practical, clear" },
  { id: "reflective", label: "Reflective", emoji: "🪞", desc: "Curious, deep" },
  { id: "cheerful", label: "Cheerful", emoji: "🌞", desc: "Upbeat, hopeful" },
  { id: "grounded", label: "Grounded", emoji: "🪨", desc: "Calm, steady" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [s, setS] = useState<Settings | null>(null);
  const [stats, setStats] = useState<{ journals: number; modules: number; pct: number } | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [delPassword, setDelPassword] = useState("");
  const [delConfirm, setDelConfirm] = useState("");

  useEffect(() => {
    api("/settings").then((r) => r.json()).then((d) => setS(d.user));
    api("/bridge").then((r) => r.json()).then((b) =>
      setStats({ journals: b.totals?.journals ?? 0, modules: b.totals?.modulesCompleted ?? 0, pct: b.progressPct ?? 0 })
    ).catch(() => {});
  }, []);

  async function patch(partial: Partial<Settings>) {
    setS((prev) => (prev ? { ...prev, ...partial } : prev));
    await api("/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  async function exportData() {
    const res = await api("/export");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `dildi-export-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    const res = await api("/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: delPassword, confirm: delConfirm }),
    });
    if (res.ok) { logout(); router.push("/welcome"); }
    else alert((await res.json()).error ?? "Could not delete");
  }

  if (!s) return <Header title="Settings" />;

  return (
    <>
      <Header title="Profile" subtitle={savedFlash ? "Saved ✓" : "Your journey, your way."} />
      <div className="space-y-4 px-1">

        {/* profile header */}
        <section className="card flex flex-col items-center text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#F2A65A] to-[#E27D6E] text-3xl font-bold text-white shadow-soft">
            {(s.name ?? s.email ?? "?").charAt(0).toUpperCase()}
          </span>
          <h2 className="serif mt-3 text-2xl font-semibold">{s.name ?? "Friend"}</h2>
          <p className="text-sm text-muted">{s.email}</p>
          {stats && (
            <div className="mt-4 grid w-full grid-cols-3 gap-2 border-t border-white/10 pt-4">
              <Stat n={stats.journals} label="Journal Entries" />
              <Stat n={stats.modules} label="CBT Modules" />
              <Stat n={`${stats.pct}%`} label="Bridge Progress" />
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="font-semibold">Companion personality</h2>
          <p className="label mt-0.5">How your AI companion speaks with you.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {PERSONAS.map((p) => {
              const active = (s.companionPersonality ?? "warm") === p.id;
              return (
                <button key={p.id} onClick={() => patch({ companionPersonality: p.id })}
                  className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition ${active ? "border-[#E27D6E] bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                  <span className="text-2xl">{p.emoji}</span>
                  <span className="text-sm font-medium">{p.label}</span>
                  <span className="text-[11px] text-muted">{p.desc}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="card">
          <h2 className="font-semibold">Emergency contact</h2>
          <p className="label mt-0.5">Notified via Telegram if a crisis is detected.</p>
          <div className="mt-3 space-y-2">
            <input className="input" placeholder="Contact name" defaultValue={s.emergencyContactName ?? ""}
              onBlur={(e) => patch({ emergencyContactName: e.target.value })} />
            <input className="input" placeholder="Phone" defaultValue={s.emergencyContactPhone ?? ""}
              onBlur={(e) => patch({ emergencyContactPhone: e.target.value })} />
            <input className="input" placeholder="Telegram chat ID" defaultValue={s.emergencyContactTelegram ?? ""}
              onBlur={(e) => patch({ emergencyContactTelegram: e.target.value })} />
          </div>
        </section>

        <section className="card">
          <h2 className="font-semibold">Security</h2>
          <Toggle label="Biometric lock" desc="Re-authenticate after inactivity"
            checked={s.biometricEnabled} onChange={(v) => patch({ biometricEnabled: v })} />
          <div className="mt-3">
            <label className="label">Auto-lock after</label>
            <select className="input mt-1" value={s.inactivityLockSeconds}
              onChange={(e) => patch({ inactivityLockSeconds: Number(e.target.value) })}>
              <option value={60}>1 minute</option>
              <option value={300}>5 minutes</option>
              <option value={900}>15 minutes</option>
            </select>
          </div>
        </section>

        <section className="card">
          <h2 className="font-semibold">Privacy</h2>
          <div className="mt-2 flex items-center justify-between rounded-xl bg-white/10 p-3">
            <div>
              <div className="font-medium">AI training on your data</div>
              <div className="text-sm text-muted">Permanently disabled. Always off in API calls.</div>
            </div>
            <span className="chip text-xs">Off 🔒</span>
          </div>
          <p className="mt-3 text-xs text-muted">
            Journal entries, chat messages and therapy notes are encrypted with AES-256-GCM
            using a key derived from your password. We can&apos;t read your content offline.
          </p>
        </section>

        <section className="card">
          <h2 className="font-semibold">Your data</h2>
          <button onClick={exportData} className="btn-ghost mt-2 w-full justify-center border border-black/10">
            Export everything (JSON)
          </button>
        </section>

        <section className="card border border-red-200">
          <h2 className="font-semibold text-red-700">Delete account</h2>
          <p className="label mt-0.5">Permanent and irreversible. Export first if unsure.</p>
          <input className="input mt-3" type="password" placeholder="Your password"
            value={delPassword} onChange={(e) => setDelPassword(e.target.value)} />
          <input className="input mt-2" placeholder='Type DELETE to confirm'
            value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} />
          <button onClick={deleteAccount} disabled={delConfirm !== "DELETE" || !delPassword}
            className="mt-3 w-full rounded-xl bg-red-600 px-4 py-2.5 font-medium text-white disabled:opacity-40">
            Permanently delete my account
          </button>
        </section>

        <button onClick={() => { logout(); router.push("/welcome"); }} className="btn-ghost w-full">
          Sign out
        </button>
      </div>
    </>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xl font-bold text-[#EAA46E]">{n}</span>
      <span className="mt-0.5 text-[11px] text-muted">{label}</span>
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="mt-2 flex items-center justify-between">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-sm text-muted">{desc}</div>
      </div>
      <button onClick={() => onChange(!checked)}
        className={`h-6 w-11 rounded-full p-0.5 transition ${checked ? "bg-primary" : "bg-black/15"}`}>
        <span className={`block h-5 w-5 rounded-full bg-white transition ${checked ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}
