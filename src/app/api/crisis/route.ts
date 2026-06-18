import { NextResponse } from "next/server";
import { collections } from "@/lib/models";
import { oid } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { CRISIS_RESOURCES } from "@/lib/crisis";

// GET /api/crisis -> current lock status + resources to display on lockout.
export async function GET() {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const users = await collections.users();
  const user = await users.findOne(
    { _id: oid(s.userId)! },
    { projection: { crisisLockedUntil: 1, emergencyContactName: 1 } },
  );
  const locked = !!user?.crisisLockedUntil && user.crisisLockedUntil > new Date();
  return NextResponse.json({
    locked,
    lockedUntil: user?.crisisLockedUntil ?? null,
    emergencyContactName: user?.emergencyContactName ?? null,
    resources: CRISIS_RESOURCES,
  });
}

// POST /api/crisis -> user acknowledges & clears the lock.
export async function POST() {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = oid(s.userId)!;
  const users = await collections.users();
  const alerts = await collections.crisisAlerts();
  await users.updateOne({ _id: userId }, { $set: { crisisLockedUntil: null } });
  await alerts.updateMany(
    { userId, status: { $ne: "RESOLVED" } },
    { $set: { status: "RESOLVED", resolvedAt: new Date() } },
  );
  return NextResponse.json({ ok: true });
}
