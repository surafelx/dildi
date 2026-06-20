"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, getToken, setToken } from "@/lib/api";

type User = { id: string; email: string; name: string | null } | null;
interface Ctx {
  user: User;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthCtx = createContext<Ctx>(null as any);
export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!getToken()) { setLoading(false); return; }
      try {
        const r = await api("/auth/me");
        if (r.ok) setUser((await r.json()).user);
        else setToken(null);
      } catch { /* offline */ }
      setLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const r = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Invalid email or password");
    const d = await r.json();
    setToken(d.token); setUser(d.user);
  }

  async function register(email: string, name: string, password: string) {
    const r = await api("/auth/register", { method: "POST", body: JSON.stringify({ email, name, password }) });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error?.fieldErrors?.password?.[0] ?? d.error ?? "Could not register");
    }
    const d = await r.json();
    setToken(d.token); setUser(d.user);
  }

  function logout() { setToken(null); setUser(null); }

  return <AuthCtx.Provider value={{ user, loading, login, register, logout }}>{children}</AuthCtx.Provider>;
}
