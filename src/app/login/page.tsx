"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import SceneBackground from "@/components/SceneBackground";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, name, password }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error?.fieldErrors?.password?.[0] ?? d.error ?? "Could not register");
        }
      }
      const r = await signIn("credentials", { email, password, redirect: false });
      if (r?.error) throw new Error("Invalid email or password");
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative h-screen overflow-hidden">
      <SceneBackground />

      <div className="flex h-screen items-center justify-center p-4">
        <div className="glass-panel no-scrollbar flex max-h-[94vh] w-full max-w-md flex-col overflow-y-auto p-7">
          {/* brand */}
          <div className="rise mb-5 text-center">
            <Logo className="mx-auto mb-3 h-14 w-14 rounded-3xl" />
            <h1 className="serif text-4xl font-semibold tracking-tight">
              <span className="gradient-text">Dildi</span>
            </h1>
            <p className="mt-1.5 text-sm text-ink/70">Your calm, private space to feel, reflect, and grow.</p>
          </div>

          <form onSubmit={submit} className="rise rise-1 space-y-3">
            <div className="mb-1 flex rounded-2xl bg-white/10 p-1 text-sm font-medium">
            <button type="button" onClick={() => setMode("login")}
              className={`flex-1 rounded-xl py-2 transition ${mode === "login" ? "bg-white text-primary shadow-soft" : "text-muted"}`}>
              Sign in
            </button>
            <button type="button" onClick={() => setMode("register")}
              className={`flex-1 rounded-xl py-2 transition ${mode === "register" ? "bg-white text-primary shadow-soft" : "text-muted"}`}>
              Create account
            </button>
          </div>

          {mode === "register" && (
            <div>
              <label className="label">Name</label>
              <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="What should we call you?" />
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input className="input mt-1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input mt-1" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "At least 10 characters" : "••••••••"} />
            {mode === "register" && (
              <p className="mt-1.5 text-xs text-muted">
                🔐 Your password encrypts your journal &amp; chats. We can&apos;t reset it — keep it safe.
              </p>
            )}
          </div>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create my account"}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] text-muted">
            Dildi is a wellbeing companion, not medical care.<br />In crisis, contact your local emergency services.
          </p>
        </div>
      </div>
    </div>
  );
}
