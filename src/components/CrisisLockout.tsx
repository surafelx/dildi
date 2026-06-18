"use client";
import { useEffect, useState } from "react";

interface CrisisInfo {
  resources: { label: string; value: string }[];
  emergencyContactName: string | null;
  lockedUntil: string | null;
}

/**
 * Full-screen, non-dismissable crisis support overlay. Shown when an API
 * returns 423 crisis_locked or when /api/crisis reports a lock. Prioritizes
 * immediate help over app functionality.
 */
export default function CrisisLockout({
  onResolve,
}: {
  onResolve?: () => void;
}) {
  const [info, setInfo] = useState<CrisisInfo | null>(null);

  useEffect(() => {
    fetch("/api/crisis")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});
  }, []);

  async function acknowledge() {
    await fetch("/api/crisis", { method: "POST" });
    onResolve?.();
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#3A2E2A] p-6 text-white">
      <div className="w-full max-w-sm text-center">
        <div className="text-4xl">🫶</div>
        <h1 className="mt-3 text-2xl font-semibold">You matter, and you&apos;re not alone</h1>
        <p className="mt-2 text-white/80">
          It sounds like you&apos;re going through something really hard right now.
          Please reach out — people are ready to help you, any time.
        </p>

        <div className="mt-6 space-y-3 text-left">
          {(info?.resources ?? []).map((r) => (
            <div key={r.label} className="rounded-xl bg-white/10 p-4">
              <div className="font-semibold">{r.label}</div>
              <div className="text-white/85">{r.value}</div>
            </div>
          ))}
        </div>

        {info?.emergencyContactName && (
          <p className="mt-4 text-sm text-white/70">
            We&apos;ve let {info.emergencyContactName} know you might need support.
          </p>
        )}

        <button
          onClick={acknowledge}
          className="mt-6 w-full rounded-xl bg-white px-4 py-3 font-medium text-[#3A2E2A]"
        >
          I&apos;m safe right now — continue
        </button>
        <p className="mt-3 text-xs text-white/50">
          If you are in immediate danger, call your local emergency number now.
        </p>
      </div>
    </div>
  );
}
