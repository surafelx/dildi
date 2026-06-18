import { NextResponse } from "next/server";
import { collections } from "./models";
import { oid } from "./db";

/** Returns a lockout response if the user is currently crisis-locked. */
export async function crisisLockResponse(userId: string) {
  const _id = oid(userId);
  if (!_id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const users = await collections.users();
  const user = await users.findOne(
    { _id },
    { projection: { crisisLockedUntil: 1 } },
  );
  if (user?.crisisLockedUntil && user.crisisLockedUntil > new Date()) {
    return NextResponse.json(
      { error: "crisis_locked", lockedUntil: user.crisisLockedUntil },
      { status: 423 },
    );
  }
  return null;
}

/** True if the user is currently crisis-locked (for non-HTTP callers, e.g. bot). */
export async function isCrisisLocked(userId: string): Promise<boolean> {
  const _id = oid(userId);
  if (!_id) return false;
  const users = await collections.users();
  const user = await users.findOne({ _id }, { projection: { crisisLockedUntil: 1 } });
  return !!user?.crisisLockedUntil && user.crisisLockedUntil > new Date();
}

/** Midnight of the given date in server local time (day bucket key). */
export function dayStart(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
