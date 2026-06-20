"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import NavBar from "./NavBar";
import InactivityLock from "./InactivityLock";
import SceneBackground from "./SceneBackground";
import { useAuth } from "./AuthProvider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isPublic = pathname === "/login" || pathname === "/welcome";

  // Client-side route guard (replaces the NextAuth middleware).
  useEffect(() => {
    if (!loading && !user && !isPublic) router.replace("/welcome");
  }, [loading, user, isPublic, router]);

  if (isPublic) {
    return (
      <>
        <SceneBackground />
        <main className="h-screen overflow-hidden">{children}</main>
      </>
    );
  }

  // Block protected content until auth is resolved.
  if (loading || !user) {
    return (
      <>
        <SceneBackground />
        <main className="flex h-screen items-center justify-center">
          <p className="text-sm text-ink/70">Loading…</p>
        </main>
      </>
    );
  }

  return (
    <>
      <SceneBackground />
      <InactivityLock />
      <NavBar />
      <main className="fixed inset-0 flex items-center justify-center overflow-hidden p-4 pb-24 md:p-6 md:pb-6 md:pl-[16rem]">
        <div className="glass-panel no-scrollbar flex max-h-[88vh] w-full max-w-2xl flex-col overflow-y-auto p-5 md:p-7">
          {children}
        </div>
      </main>
    </>
  );
}
