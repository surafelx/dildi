"use client";
import Link from "next/link";
import Header from "@/components/Header";

const TOOLS = [
  { href: "/program", icon: "🧭", title: "Anxiety Toolkit", desc: "CBT skills to manage anxious thoughts." },
  { href: "/exercises", icon: "🫧", title: "Stress Relief", desc: "Breathing & relaxation exercises." },
  { href: "/sleep", icon: "🌙", title: "Sleep Better", desc: "Wind-down sounds and a sleep timer." },
  { href: "/exercises", icon: "💛", title: "Self-Compassion", desc: "Affirmations and grounding practices." },
];

export default function TherapyPage() {
  return (
    <>
      <Header title="Therapy" subtitle="Self-guided support, whenever you need it." />
      <div className="space-y-3 px-1">
        <div className="card bg-gradient-to-br from-[#F2A65A]/15 to-[#E27D6E]/15">
          <p className="text-sm text-ink/85">
            Dildi offers evidence-based, self-guided tools — not a replacement for a
            therapist. Work through them at your own pace, anytime.
          </p>
        </div>

        <h2 className="px-1 font-semibold">Tools &amp; Resources</h2>
        {TOOLS.map((t) => (
          <Link key={t.title} href={t.href} className="card flex items-center gap-3 transition hover:brightness-110">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-xl">{t.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t.title}</span>
              <span className="block text-sm text-muted">{t.desc}</span>
            </span>
            <span className="text-muted">›</span>
          </Link>
        ))}

        {/* responsible referral — no in-app human booking */}
        <div className="card border border-[#E27D6E]/30">
          <h3 className="font-semibold">When you need more support</h3>
          <p className="mt-1 text-sm text-ink/80">
            If you&apos;re struggling, talking to a licensed professional can help. Consider
            reaching out to a therapist, your doctor, or a local service.
          </p>
          <p className="mt-2 text-sm text-ink/80">
            In crisis, contact your local emergency number or a crisis line right away —
            you deserve support, now.
          </p>
        </div>
      </div>
    </>
  );
}
