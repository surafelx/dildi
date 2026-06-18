import { NextResponse } from "next/server";
import { z } from "zod";
import { collections, toId } from "@/lib/models";
import { oid } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { encrypt, decrypt } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { crisisLockResponse } from "@/lib/guard";
import { runCrisisCheck } from "@/lib/crisis-handler";

// GET /api/thought-records -> list, decrypted, newest first
export async function GET() {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const col = await collections.thoughtRecords();
  const rows = await col.find({ userId: oid(s.userId)! }).sort({ createdAt: -1 }).limit(100).toArray();
  await audit(s.userId, "thoughtRecord.read", `count:${rows.length}`);
  const records = rows.map((r) => ({
    id: toId(r._id),
    moduleId: r.moduleId,
    situation: decrypt(r.situationEnc, s.key),
    automaticThought: decrypt(r.automaticThoughtEnc, s.key),
    evidenceFor: r.evidenceForEnc ? decrypt(r.evidenceForEnc, s.key) : null,
    evidenceAgainst: r.evidenceAgainstEnc ? decrypt(r.evidenceAgainstEnc, s.key) : null,
    balancedThought: r.balancedThoughtEnc ? decrypt(r.balancedThoughtEnc, s.key) : null,
    emotion: r.emotionEnc ? decrypt(r.emotionEnc, s.key) : null,
    intensityBefore: r.intensityBefore,
    intensityAfter: r.intensityAfter,
    distortions: r.distortions,
    createdAt: r.createdAt,
  }));
  return NextResponse.json({ records });
}

const schema = z.object({
  moduleId: z.string().max(64).optional(),
  situation: z.string().min(1).max(5000),
  emotion: z.string().max(200).optional(),
  intensityBefore: z.number().int().min(0).max(100),
  automaticThought: z.string().min(1).max(5000),
  distortions: z.array(z.string().max(40)).max(20).optional(),
  evidenceFor: z.string().max(5000).optional(),
  evidenceAgainst: z.string().max(5000).optional(),
  balancedThought: z.string().max(5000).optional(),
  intensityAfter: z.number().int().min(0).max(100).optional(),
});

// POST /api/thought-records -> create (encrypted, crisis-screened)
export async function POST(req: Request) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const locked = await crisisLockResponse(s.userId);
  if (locked) return locked;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  // Screen the free-text fields for crisis language before storing.
  const blob = [d.situation, d.automaticThought, d.evidenceFor, d.evidenceAgainst, d.balancedThought]
    .filter(Boolean)
    .join("\n");
  const crisis = await runCrisisCheck(s.userId, blob, "journal");
  if (crisis.triggered) {
    return NextResponse.json(
      { error: "crisis_locked", crisis: { categories: crisis.categories, lockedUntil: crisis.lockedUntil } },
      { status: 423 },
    );
  }

  const col = await collections.thoughtRecords();
  const res = await col.insertOne({
    userId: oid(s.userId)!,
    moduleId: d.moduleId ?? null,
    situationEnc: encrypt(d.situation, s.key),
    automaticThoughtEnc: encrypt(d.automaticThought, s.key),
    evidenceForEnc: d.evidenceFor ? encrypt(d.evidenceFor, s.key) : null,
    evidenceAgainstEnc: d.evidenceAgainst ? encrypt(d.evidenceAgainst, s.key) : null,
    balancedThoughtEnc: d.balancedThought ? encrypt(d.balancedThought, s.key) : null,
    emotionEnc: d.emotion ? encrypt(d.emotion, s.key) : null,
    intensityBefore: d.intensityBefore,
    intensityAfter: d.intensityAfter ?? null,
    distortions: d.distortions ?? [],
    createdAt: new Date(),
  });
  await audit(s.userId, "thoughtRecord.create", `record:${res.insertedId.toHexString()}`);
  return NextResponse.json({ id: res.insertedId.toHexString() });
}
