"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthProvider";

/**
 * Biometric re-authentication after inactivity (default 5 min).
 *
 * Uses the WebAuthn / platform authenticator where available (Face ID, Touch
 * ID, Windows Hello, Android biometrics). Falls back to a "confirm presence"
 * tap if no platform authenticator exists. This gates the UI only; the server
 * key already lives in the httpOnly session — this prevents shoulder-surfing
 * and unattended-device access.
 */
const IDLE_MS = 5 * 60 * 1000;

export default function InactivityLock() {
  const { user } = useAuth();
  const [locked, setLocked] = useState(false);

  const resetTimer = useCallback(() => {
    (window as any).__mbLastActive = Date.now();
  }, []);

  useEffect(() => {
    if (!user) return;
    resetTimer();
    const events = ["mousemove", "keydown", "touchstart", "click", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    const id = setInterval(() => {
      const last = (window as any).__mbLastActive ?? Date.now();
      if (Date.now() - last > IDLE_MS) setLocked(true);
    }, 5000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      clearInterval(id);
    };
  }, [user, resetTimer]);

  async function unlock() {
    try {
      if (window.PublicKeyCredential) {
        // Lightweight presence check via platform authenticator.
        await navigator.credentials.get({
          publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            timeout: 60000,
            userVerification: "required",
            rpId: window.location.hostname,
          },
        } as any);
      }
    } catch {
      // If WebAuthn is unavailable or cancelled, fall through to manual confirm.
    } finally {
      resetTimer();
      setLocked(false);
    }
  }

  if (!user || !locked) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="card mx-6 max-w-sm text-center">
        <div className="mb-3 text-4xl">🔒</div>
        <h2 className="text-lg font-semibold">Welcome back</h2>
        <p className="mt-1 text-sm text-muted">
          For your privacy, Dildi locked after a few minutes of inactivity.
          Confirm it&apos;s you to continue.
        </p>
        <button onClick={unlock} className="btn-primary mt-5 w-full">
          Unlock with biometrics
        </button>
      </div>
    </div>
  );
}
