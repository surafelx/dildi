import { NextResponse } from "next/server";
import { z } from "zod";
import { collections, toId, CalendarKind } from "@/lib/models";
import { oid } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { listUpcomingEvents, createEvent } from "@/lib/google-calendar";

function classify(title: string): CalendarKind {
  if (/therap|counsel|session/i.test(title)) return "THERAPY";
  if (/check[\s-]?in|mood/i.test(title)) return "CHECKIN_REMINDER";
  return "OTHER";
}

// GET /api/calendar -> sync from Google + return upcoming events.
export async function GET() {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const col = await collections.calendarEvents();

  try {
    const gevents = await listUpcomingEvents();
    for (const g of gevents) {
      await col.updateOne(
        { googleEventId: g.googleEventId },
        {
          $set: {
            title: g.title,
            start: g.start,
            end: g.end,
            location: g.location,
            kind: classify(g.title),
            syncedAt: new Date(),
          },
          $setOnInsert: { userId: oid(s.userId)!, googleEventId: g.googleEventId },
        },
        { upsert: true },
      );
    }
  } catch (e) {
    console.warn("[calendar] Google sync failed, returning local cache", e);
  }

  const rows = await col
    .find({ userId: oid(s.userId)!, start: { $gte: new Date(Date.now() - 86400000) } })
    .sort({ start: 1 })
    .toArray();
  const events = rows.map((e) => ({ ...e, id: toId(e._id), _id: undefined }));
  return NextResponse.json({ events });
}

const schema = z.object({
  title: z.string().min(1).max(200),
  start: z.string().datetime(),
  end: z.string().datetime(),
  kind: z.enum(["THERAPY", "CHECKIN_REMINDER", "OTHER"]).default("OTHER"),
});

// POST /api/calendar -> create event in Google + mirror locally.
export async function POST(req: Request) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { title, start, end, kind } = parsed.data;

  let googleEventId: string | null = null;
  try {
    googleEventId = await createEvent({
      title,
      start: new Date(start),
      end: new Date(end),
      description: "Created via Dildi",
    });
  } catch (e) {
    console.warn("[calendar] Google create failed, storing locally only", e);
  }

  const col = await collections.calendarEvents();
  const res = await col.insertOne({
    userId: oid(s.userId)!,
    googleEventId,
    kind: kind as CalendarKind,
    title,
    start: new Date(start),
    end: new Date(end),
    location: null,
    syncedAt: new Date(),
  });
  return NextResponse.json({ id: res.insertedId.toHexString() });
}
