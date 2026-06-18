import { NextResponse } from "next/server";
import { z } from "zod";
import { collections, toId } from "@/lib/models";
import { oid } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { dayStart } from "@/lib/guard";

const slider = z.number().int().min(1).max(10);
const schema = z.object({
  mood: slider,
  anxiety: slider,
  energy: slider,
  sleepQuality: slider,
  sleepHours: z.number().min(0).max(14),
  date: z.string().datetime().optional(),
});

// GET /api/mood?days=30  -> recent mood logs
export async function GET(req: Request) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const days = Number(new URL(req.url).searchParams.get("days") ?? 30);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const moodLogs = await collections.moodLogs();
  const rows = await moodLogs
    .find({ userId: oid(s.userId)!, date: { $gte: dayStart(since) } })
    .sort({ date: 1 })
    .toArray();
  const logs = rows.map((m) => ({ ...m, id: toId(m._id), _id: undefined }));
  return NextResponse.json({ logs });
}

// POST /api/mood -> upsert today's (or given day's) check-in
export async function POST(req: Request) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { date, ...vals } = parsed.data;
  const day = dayStart(date ? new Date(date) : new Date());
  const moodLogs = await collections.moodLogs();
  await moodLogs.updateOne(
    { userId: oid(s.userId)!, date: day },
    {
      $set: { ...vals },
      $setOnInsert: { userId: oid(s.userId)!, date: day, createdAt: new Date() },
    },
    { upsert: true },
  );
  return NextResponse.json({ ok: true });
}
