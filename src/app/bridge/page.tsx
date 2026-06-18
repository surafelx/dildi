"use client";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import type { BridgeResult } from "@/lib/bridge";

export default function BridgePage() {
  const [data, setData] = useState<BridgeResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bridge").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Header title="Your Bridge" subtitle="You're building something beautiful." />
      <div className="space-y-4 px-1">
        {loading && <p className="text-sm text-muted">Measuring how far you've come…</p>}

        {data && (
          <>
            {/* level + progress */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="label">Level {data.level}</p>
                  <h2 className="serif text-2xl font-semibold">{data.levelName}</h2>
                </div>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F2A65A] to-[#E27D6E] text-2xl font-bold text-white shadow-soft">
                  {data.level}
                </span>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="label">Bridge progress</span>
                  <span className="font-semibold text-primary">{data.progressPct}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-black/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#F2A65A] to-[#E27D6E] transition-all duration-700"
                    style={{ width: `${data.progressPct}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted">
                  {data.nextLevelName
                    ? `You've crossed ${data.progressPct}% toward "${data.nextLevelName}." Keep going. 🌿`
                    : "You've walked the whole bridge. Beautifully done. 🌅"}
                </p>
              </div>
            </div>

            {/* streak + points */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card items-center text-center">
                <div className="text-3xl font-bold text-accent">{data.streak}🔥</div>
                <div className="label mt-1">Day streak</div>
              </div>
              <div className="card items-center text-center">
                <div className="text-3xl font-bold text-primary">{data.points}</div>
                <div className="label mt-1">Steps taken</div>
              </div>
            </div>

            {/* what builds the bridge */}
            <div className="card">
              <h3 className="font-semibold">What you've built</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                <Row icon="🙂" label="Check-ins" n={data.totals.moods} />
                <Row icon="📓" label="Journal entries" n={data.totals.journals} />
                <Row icon="✅" label="Activities" n={data.totals.activities} />
                <Row icon="🔍" label="Thought records" n={data.totals.thoughtRecords} />
                <Row icon="🧭" label="CBT modules" n={data.totals.modulesCompleted} />
              </ul>
            </div>

            {/* milestones */}
            <div className="card">
              <h3 className="font-semibold">Milestones</h3>
              <div className="mt-3 space-y-2">
                {data.milestones.map((m) => (
                  <div key={m.id} className={`flex items-center gap-3 rounded-2xl border border-white/30 p-3 transition ${m.earned ? "bg-white/20" : "bg-white/5 opacity-55"}`}>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full text-lg ${m.earned ? "bg-gradient-to-br from-primary/30 to-accent/30" : "bg-black/10 grayscale"}`}>
                      {m.earned ? m.icon : "🔒"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{m.title}</div>
                      <div className="truncate text-sm text-muted">{m.note}</div>
                    </div>
                    {m.earned && <span className="text-primary">✓</span>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Row({ icon, label, n }: { icon: string; label: string; n: number }) {
  return (
    <li className="flex items-center gap-2">
      <span>{icon}</span>
      <span>{label}</span>
      <span className="ml-auto font-semibold text-ink/80">{n}</span>
    </li>
  );
}
