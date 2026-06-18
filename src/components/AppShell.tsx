"use client";
import { usePathname } from "next/navigation";
import NavBar from "./NavBar";
import InactivityLock from "./InactivityLock";
import SceneBackground from "./SceneBackground";

/**
 * Every page: the clear garden photo fills the background, and the page's
 * content lives on a centered frosted-glass panel. Nothing scrolls the page —
 * a too-tall panel scrolls internally (hidden scrollbar).
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = pathname === "/login" || pathname === "/welcome";

  // Public pages render their own glass layout (login/welcome).
  if (isPublic) {
    return (
      <>
        <SceneBackground />
        <main className="h-screen overflow-hidden">{children}</main>
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
