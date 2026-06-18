import { NextResponse } from "next/server";
import { z } from "zod";
import { collections } from "@/lib/models";
import { oid } from "@/lib/db";
import { requireSession } from "@/lib/session";

// GET /api/program -> the user's CBT progress (completed module ids)
export async function GET() {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const col = await collections.cbtProgress();
  const doc = await col.findOne({ userId: oid(s.userId)! });
  return NextResponse.json({ completedModules: doc?.completedModules ?? [] });
}

const schema = z.object({
  moduleId: z.string().max(64),
  completed: z.boolean().default(true),
});

// POST /api/program -> mark a module complete / incomplete
export async function POST(req: Request) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { moduleId, completed } = parsed.data;
  const col = await collections.cbtProgress();
  const userId = oid(s.userId)!;
  await col.updateOne(
    { userId },
    {
      ...(completed
        ? { $addToSet: { completedModules: moduleId } }
        : { $pull: { completedModules: moduleId } }),
      $set: { updatedAt: new Date() },
      $setOnInsert: { userId },
    },
    { upsert: true },
  );
  const doc = await col.findOne({ userId });
  return NextResponse.json({ completedModules: doc?.completedModules ?? [] });
}
