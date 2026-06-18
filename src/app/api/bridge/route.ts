import { NextResponse } from "next/server";
import { collections } from "@/lib/models";
import { oid } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { computeBridge } from "@/lib/bridge";

// GET /api/bridge -> the user's progress (levels, %, streak, milestones).
// Derived from existing data; nothing sensitive is decrypted here.
export async function GET() {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = oid(s.userId)!;

  const [moodC, actC, jrnC, trC, cbtC] = await Promise.all([
    collections.moodLogs(), collections.activities(), collections.journalEntries(),
    collections.thoughtRecords(), collections.cbtProgress(),
  ]);

  const [moodDocs, activities, journalDocs, thoughtRecords, cbt] = await Promise.all([
    moodC.find({ userId }, { projection: { date: 1 } }).toArray(),
    actC.countDocuments({ userId }),
    jrnC.find({ userId }, { projection: { date: 1 } }).toArray(),
    trC.countDocuments({ userId }),
    cbtC.findOne({ userId }, { projection: { completedModules: 1 } }),
  ]);

  const result = computeBridge({
    moods: moodDocs.length,
    journals: journalDocs.length,
    activities,
    thoughtRecords,
    modulesCompleted: cbt?.completedModules?.length ?? 0,
    checkinDates: moodDocs.map((m) => m.date.toISOString()),
    journalDates: journalDocs.map((j) => j.date.toISOString()),
  });

  return NextResponse.json(result);
}
