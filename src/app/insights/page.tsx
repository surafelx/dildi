"use client";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface MoodLog { date: string; mood: number; anxiety: number; energy: number; sleepHours: number }
interface Emotion { label: string; pct: number }
interface InsightsData {
  summary: {
    averages: Record<string, number | null>;
    activityCounts: Record<string, number>;
    checkInCount: number;
    journalCount: number;
  };
  moods: MoodLog[];
  narrative: string;
  topEmotions: Emotion[];
}

const RANGES = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
] as const;

const EMO_COLORS = ["#F2A65A", "#E27D6E", "#C77FA6", "#9B7BC0", "#7C8FB0"];

export default function InsightsPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("week");
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/insights?range=${range}`).then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, [range]);

  const moodSeries = (data?.moods ?? []).map((m) => ({
    day: new Date(m.date).toLocaleDateString([], { month: "short", day: "numeric" }),
    mood: m.mood,
  }));

  return (
    <>
      <Header title="Insights" subtitle="Understand yourself better every day." />
      <div className="space-y-4 px-1">
        {/* range tabs */}
        <div className="flex gap-2 rounded-2xl bg-white/10 p-1">
          {RANGES.map((r) => (
            <button key={r.id} onClick={() => setRange(r.id)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${range === r.id ? "bg-gradient-to-r from-[#F2A65A] to-[#E27D6E] text-white" : "text-muted"}`}>
              {r.label}
            </button>
          ))}
        </div>

        {loading && <p className="text-sm text-muted">Reflecting…</p>}

        {data && !loading && (
          <>
            {/* mood overview */}
            <div className="card">
              <h3 className="mb-1 font-semibold">Mood Overview</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={moodSeries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="day" tick={{ fill: "#C7CBC4", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 10]} tick={{ fill: "#C7CBC4", fontSize: 10 }} width={28} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "rgba(30,23,32,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#F4F1EA" }} />
                    <Line type="monotone" dataKey="mood" stroke="#F2A65A" strokeWidth={2.5} dot={{ r: 3, fill: "#E27D6E" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* top emotions */}
            <div className="card">
              <h3 className="font-semibold">Top Emotions</h3>
              <p className="label">This {range}</p>
              {data.topEmotions.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Tag your feelings in journal entries or check-ins to see patterns here.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {data.topEmotions.map((e, i) => (
                    <div key={e.label}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{e.label}</span>
                        <span className="font-semibold text-ink/80">{e.pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full" style={{ width: `${e.pct}%`, background: EMO_COLORS[i % EMO_COLORS.length] }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* quick stats */}
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Avg mood" value={data.summary.averages.mood} />
              <Stat label="Check-ins" value={data.summary.checkInCount} />
              <Stat label="Entries" value={data.summary.journalCount} />
            </div>

            {/* narrative */}
            <div className="card bg-gradient-to-br from-[#F2A65A]/15 to-[#E27D6E]/15">
              <h3 className="font-semibold">Your reflection</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/85">{data.narrative}</p>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="card items-center text-center">
      <div className="text-2xl font-bold text-[#EAA46E]">{value ?? "—"}</div>
      <div className="label mt-0.5">{label}</div>
    </div>
  );
}
