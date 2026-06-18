import Link from "next/link";
import LogoOrb from "@/components/LogoOrb";
import SceneBackground from "@/components/SceneBackground";

export const metadata = {
  title: "Dildi — every step connects you to a better you",
  description: "A calm, private, encrypted space for mood, journaling, reflection, and a warm companion.",
};

export default function Welcome() {
  return (
    <div className="relative h-screen overflow-hidden">
      <SceneBackground />
      <div className="flex h-screen items-center justify-center p-5">
        <div className="glass-panel no-scrollbar flex w-full max-w-sm flex-col items-center overflow-y-auto px-7 py-10 text-center">
          <LogoOrb />

          <h1 className="serif mt-6 text-5xl font-semibold lowercase tracking-tight text-[#EAA46E]">
            dildi
          </h1>
          <p className="mt-3 text-ink/80">Every step connects you<br />to a better you.</p>

          <div className="mt-8 flex w-full flex-col gap-3">
            <Link
              href="/login"
              className="rounded-2xl bg-gradient-to-r from-[#F2A65A] to-[#E27D6E] px-5 py-3.5 font-semibold text-white shadow-[0_10px_30px_-8px_rgba(226,125,110,0.7)] transition hover:brightness-105 active:scale-[0.98]"
            >
              Create account
            </Link>
            <Link href="/login" className="text-sm font-medium text-ink/70 transition hover:text-ink">
              I already have an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
