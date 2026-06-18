import { NextResponse } from "next/server";
import { z } from "zod";
import { collections, toId } from "@/lib/models";
import { oid } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { encrypt, decrypt } from "@/lib/crypto";

const schema = z.object({
  type: z.enum(["EXERCISE", "MEDITATION", "SOCIAL", "THERAPY", "OTHER"]),
  note: z.string().max(2000).optional(),
  occurredAt: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const days = Number(new URL(req.url).searchParams.get("days") ?? 14);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const col = await collections.activities();
  const rows = await col
    .find({ userId: oid(s.userId)!, occurredAt: { $gte: since } })
    .sort({ occurredAt: -1 })
    .toArray();
  const activities = rows.map((a) => ({
    id: toId(a._id),
    type: a.type,
    occurredAt: a.occurredAt,
    note: a.note ? decrypt(a.note, s.key) : null,
  }));
  return NextResponse.json({ activities });
}

export async function POST(req: Request) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { type, note, occurredAt } = parsed.data;
  const col = await collections.activities();
  const res = await col.insertOne({
    userId: oid(s.userId)!,
    type,
    note: note ? encrypt(note, s.key) : null,
    occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
  });
  return NextResponse.json({ id: res.insertedId.toHexString() });
}
