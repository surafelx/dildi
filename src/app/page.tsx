"use client";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import Link from "next/link";
import CrisisLockout from "@/components/CrisisLockout";
import Logo from "@/components/Logo";

const QUICK = [
  { href: "/checkin", label: "Mood", icon: "🙂" },
  { href: "/insights", label: "Insights", icon: "📊" },
  { href: "/journal", label: "Journal", icon: "📓" },
  { href: "/therapy", label: "Therapy", icon: "🧭" },
  { href: "/exercises", label: "Exercises", icon: "🫧" },
  { href: "/sleep", label: "Sleep", icon: "🌙" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
];

export default function Dashboard() {
  const [name, setName] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    api("/crisis").then((r) => r.json()).then((c) => setLocked(!!c.locked)).catch(() => {});
    api("/settings").then((r) => r.json()).then((d) => setName(d.user?.name ?? null)).catch(() => {});
  }, []);

  if (locked) return <CrisisLockout onResolve={() => setLocked(false)} />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="space-y-5 px-1">
      {/* greeting header */}
      <header className="rise flex items-start justify-between pt-1">
        <div>
          <p className="text-sm text-ink/70">{greeting}</p>
          <h1 className="serif text-3xl font-semibold tracking-tight">
            {name ?? "Friend"} <span className="align-middle">👋</span>
          </h1>
          <p className="mt-1 text-sm text-muted">How are you feeling today?</p>
        </div>
        <Logo className="h-10 w-10" />
      </header>

      {/* feeling check-in */}
      <Link href="/checkin" className="card rise rise-1 block transition hover:brightness-110">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Daily check-in</h2>
            <p className="mt-1 text-sm text-muted">Take a moment to check in with yourself.</p>
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#F2A65A] to-[#E27D6E] text-xl text-white">🙂</span>
        </div>
      </Link>

      {/* Today's Reflection */}
      <div className="card rise rise-2">
        <h2 className="font-semibold">Today&apos;s Reflection</h2>
        <p className="mt-1 text-sm text-muted">Write freely — your private, encrypted space.</p>
        <Link href="/journal" className="btn-primary mt-4 inline-block w-full text-center">Start journaling</Link>
      </div>

      {/* Quick Access */}
      <section className="rise rise-3">
        <h2 className="mb-2 font-semibold">Quick Access</h2>
        <div className="grid grid-cols-3 gap-3">
          {QUICK.map((q) => (
            <Link key={q.href} href={q.href}
              className="card flex flex-col items-center gap-2 py-5 text-sm font-medium transition hover:brightness-110">
              <span className="text-2xl">{q.icon}</span>
              {q.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
