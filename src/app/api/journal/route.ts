import { NextResponse } from "next/server";
import { z } from "zod";
import { collections, toId } from "@/lib/models";
import { oid } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { encrypt, decrypt } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { dayStart, crisisLockResponse } from "@/lib/guard";
import { runCrisisCheck } from "@/lib/crisis-handler";

const schema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().min(1).max(50_000),
  moodTags: z.array(z.string().max(40)).max(20).optional(),
  date: z.string().datetime().optional(),
});

// GET /api/journal           -> list (decrypted) entries, newest first
// GET /api/journal?date=ISO  -> entries for a specific day
export async function GET(req: Request) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const dateParam = new URL(req.url).searchParams.get("date");
  const filter: any = { userId: oid(s.userId)! };
  if (dateParam) filter.date = dayStart(new Date(dateParam));

  const col = await collections.journalEntries();
  const rows = await col.find(filter).sort({ date: -1 }).limit(200).toArray();
  await audit(s.userId, "journal.read", `count:${rows.length}`);

  const entries = rows.map((e) => ({
    id: toId(e._id),
    date: e.date,
    title: e.titleEnc ? decrypt(e.titleEnc, s.key) : null,
    body: decrypt(e.bodyEnc, s.key),
    moodTags: e.moodTags,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const locked = await crisisLockResponse(s.userId);
  if (locked) return locked;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { title, body, moodTags, date } = parsed.data;

  // Crisis scan on plaintext BEFORE encrypting/storing.
  const crisis = await runCrisisCheck(s.userId, `${title ?? ""}\n${body}`, "journal");
  if (crisis.triggered) {
    return NextResponse.json(
      { error: "crisis_locked", crisis: { categories: crisis.categories, lockedUntil: crisis.lockedUntil } },
      { status: 423 },
    );
  }

  const day = dayStart(date ? new Date(date) : new Date());
  const moodLogs = await collections.moodLogs();
  const linkedMood = await moodLogs.findOne(
    { userId: oid(s.userId)!, date: day },
    { projection: { _id: 1 } },
  );

  const col = await collections.journalEntries();
  const now = new Date();
  const res = await col.insertOne({
    userId: oid(s.userId)!,
    date: day,
    titleEnc: title ? encrypt(title, s.key) : null,
    bodyEnc: encrypt(body, s.key),
    moodTags: moodTags ?? [],
    linkedMoodId: linkedMood?._id ?? null,
    createdAt: now,
    updatedAt: now,
  });
  await audit(s.userId, "journal.create", `entry:${res.insertedId.toHexString()}`);
  return NextResponse.json({ id: res.insertedId.toHexString() });
}
