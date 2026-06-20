"use client";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import Header from "@/components/Header";

interface CalEvent {
  id: string; title: string; start: string; end: string | null; kind: string; location: string | null;
}

const KIND_CHIP: Record<string, string> = {
  THERAPY: "🛋️ Therapy", CHECKIN_REMINDER: "🔔 Check-in", OTHER: "📌 Event",
};

export default function CalendarPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/calendar")
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .finally(() => setLoading(false));
  }, []);

  // Group by day.
  const groups = events.reduce<Record<string, CalEvent[]>>((acc, e) => {
    const key = new Date(e.start).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  return (
    <>
      <Header title="Calendar" subtitle="Synced with Google Calendar." />
      <div className="space-y-5 px-1">
        {loading && <p className="text-sm text-muted">Syncing your calendar…</p>}
        {!loading && events.length === 0 && (
          <div className="card text-sm text-muted">No upcoming events.</div>
        )}
        {Object.entries(groups).map(([day, evs]) => (
          <section key={day}>
            <h2 className="mb-2 text-sm font-semibold text-muted">{day}</h2>
            <div className="space-y-2">
              {evs.map((e) => (
                <div key={e.id} className="card flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{e.title}</div>
                    <div className="text-sm text-muted">
                      {new Date(e.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      {e.location ? ` · ${e.location}` : ""}
                    </div>
                  </div>
                  <span className="chip text-xs">{KIND_CHIP[e.kind] ?? "📌"}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
