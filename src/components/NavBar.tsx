"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";

// Primary nav kept short. Secondary screens (Program, Insights, Calendar) are
// reached from the Home quick-access grid.
const TABS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/bridge", label: "Bridge", icon: "🌉" },
  { href: "/chat", label: "Chat", icon: "💬" },
  { href: "/settings", label: "Profile", icon: "👤" },
];

export default function NavBar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <>
      {/* Desktop: fixed left sidebar */}
      <aside className="fixed bottom-4 left-4 top-4 z-30 hidden w-56 flex-col rounded-[2rem] border border-white/25 bg-white/[0.05] px-4 py-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_20px_50px_-20px_rgba(43,51,48,0.45)] [backdrop-filter:blur(10px)] md:flex">
        <Link href="/" className="mb-8 flex items-center gap-2 px-2">
          <Logo className="h-9 w-9" />
          <span className="serif gradient-text text-2xl font-semibold">Dildi</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-gradient-to-br from-[#F2A65A] to-[#E27D6E] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_20px_-10px_rgba(226,125,110,0.8)] before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-x-1.5 before:-translate-y-1/2 before:rounded-full before:bg-[#E27D6E]"
                    : "text-muted hover:bg-white/40 hover:text-ink"
                }`}
              >
                <span className="text-lg leading-none">{t.icon}</span>
                {t.label}
              </Link>
            );
          })}
        </nav>
        <p className="px-3 text-xs text-muted">A wellbeing companion,<br />not medical care.</p>
      </aside>

      {/* Mobile: floating bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-between gap-1 rounded-3xl border border-white/25 bg-white/[0.06] px-2 py-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_12px_32px_-12px_rgba(43,51,48,0.35)] [backdrop-filter:blur(10px)]">
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] transition ${
                  active ? "bg-gradient-to-br from-[#F2A65A] to-[#E27D6E] text-white font-semibold shadow-soft" : "text-muted hover:bg-black/5"
                }`}
              >
                <span className="text-lg leading-none">{t.icon}</span>
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
