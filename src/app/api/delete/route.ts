import { NextResponse } from "next/server";
import { z } from "zod";
import { collections } from "@/lib/models";
import { oid } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { verifyPassword } from "@/lib/auth";

/**
 * POST /api/delete -> permanent, irreversible account + data deletion.
 * Requires password re-entry. Manually cascades across all collections.
 */
const schema = z.object({ password: z.string(), confirm: z.literal("DELETE") });

export async function POST(req: Request) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  }
  const userId = oid(s.userId)!;
  const users = await collections.users();
  const user = await users.findOne({ _id: userId });
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
  }

  // Gather conversation ids to cascade chat messages.
  const convC = await collections.chatConversations();
  const convoIds = (await convC.find({ userId }, { projection: { _id: 1 } }).toArray()).map((c) => c._id!);

  const [moodC, actC, jrnC, calC, msgC, crisisC, goalC, auditC, trC, cbtC] = await Promise.all([
    collections.moodLogs(), collections.activities(), collections.journalEntries(),
    collections.calendarEvents(), collections.chatMessages(), collections.crisisAlerts(),
    collections.goals(), collections.auditLogs(),
    collections.thoughtRecords(), collections.cbtProgress(),
  ]);

  await Promise.all([
    moodC.deleteMany({ userId }),
    actC.deleteMany({ userId }),
    jrnC.deleteMany({ userId }),
    calC.deleteMany({ userId }),
    msgC.deleteMany({ conversationId: { $in: convoIds } }),
    convC.deleteMany({ userId }),
    crisisC.deleteMany({ userId }),
    goalC.deleteMany({ userId }),
    auditC.deleteMany({ userId }),
    trC.deleteMany({ userId }),
    cbtC.deleteMany({ userId }),
  ]);
  await users.deleteOne({ _id: userId });

  return NextResponse.json({ ok: true, deleted: true });
}
