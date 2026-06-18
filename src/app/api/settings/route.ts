import { NextResponse } from "next/server";
import { z } from "zod";
import { collections } from "@/lib/models";
import { oid } from "@/lib/db";
import { requireSession } from "@/lib/session";

export async function GET() {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const users = await collections.users();
  const u = await users.findOne(
    { _id: oid(s.userId)! },
    {
      projection: {
        name: 1, email: 1, biometricEnabled: 1, inactivityLockSeconds: 1,
        allowAiTraining: 1, emergencyContactName: 1, emergencyContactPhone: 1,
        emergencyContactTelegram: 1, telegramChatId: 1,
      },
    },
  );
  return NextResponse.json({ user: u ? { ...u, _id: undefined } : null });
}

const schema = z.object({
  name: z.string().max(120).optional(),
  biometricEnabled: z.boolean().optional(),
  inactivityLockSeconds: z.number().int().min(30).max(3600).optional(),
  emergencyContactName: z.string().max(120).optional(),
  emergencyContactPhone: z.string().max(40).optional(),
  emergencyContactTelegram: z.string().max(64).optional(),
});

export async function PATCH(req: Request) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const users = await collections.users();
  await users.updateOne(
    { _id: oid(s.userId)! },
    { $set: { ...parsed.data, updatedAt: new Date() } },
  );
  return NextResponse.json({ ok: true });
}
