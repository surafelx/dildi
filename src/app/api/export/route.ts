import { NextResponse } from "next/server";
import { collections, toId } from "@/lib/models";
import { oid } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { decrypt } from "@/lib/crypto";
import { audit } from "@/lib/audit";

/**
 * GET /api/export -> full data export as JSON, with all encrypted content
 * decrypted using the in-session key. Streamed as a download.
 */
export async function GET() {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = oid(s.userId)!;

  const [usersC, moodC, actC, jrnC, calC, convC, msgC, goalC, trC] = await Promise.all([
    collections.users(), collections.moodLogs(), collections.activities(),
    collections.journalEntries(), collections.calendarEvents(),
    collections.chatConversations(), collections.chatMessages(), collections.goals(),
    collections.thoughtRecords(),
  ]);

  const [user, moods, activities, journals, calendar, conversations, goals, thoughtRecords] = await Promise.all([
    usersC.findOne({ _id: userId }, { projection: { passwordHash: 0, encSalt: 0, encVerifier: 0 } }),
    moodC.find({ userId }).toArray(),
    actC.find({ userId }).toArray(),
    jrnC.find({ userId }).toArray(),
    calC.find({ userId }).toArray(),
    convC.find({ userId }).toArray(),
    goalC.find({ userId }).toArray(),
    trC.find({ userId }).toArray(),
  ]);

  await audit(s.userId, "export.create", "full");

  const conversationsOut = [];
  for (const c of conversations) {
    const msgs = await msgC.find({ conversationId: c._id! }).sort({ createdAt: 1 }).toArray();
    conversationsOut.push({
      id: toId(c._id),
      title: c.title,
      createdAt: c.createdAt,
      messages: msgs.map((m) => ({
        role: m.role,
        content: decrypt(m.contentEnc, s.key),
        createdAt: m.createdAt,
      })),
    });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    user: user ? { ...user, id: toId(user._id), _id: undefined } : null,
    moodLogs: moods.map((m) => ({ ...m, id: toId(m._id), _id: undefined })),
    activities: activities.map((a) => ({
      id: toId(a._id), type: a.type, occurredAt: a.occurredAt,
      note: a.note ? decrypt(a.note, s.key) : null,
    })),
    journalEntries: journals.map((j) => ({
      id: toId(j._id), date: j.date,
      title: j.titleEnc ? decrypt(j.titleEnc, s.key) : null,
      body: decrypt(j.bodyEnc, s.key),
      moodTags: j.moodTags, createdAt: j.createdAt,
    })),
    calendar: calendar.map((e) => ({ ...e, id: toId(e._id), _id: undefined })),
    conversations: conversationsOut,
    goals: goals.map((g) => ({ ...g, id: toId(g._id), _id: undefined })),
    thoughtRecords: thoughtRecords.map((r) => ({
      id: toId(r._id), moduleId: r.moduleId,
      situation: decrypt(r.situationEnc, s.key),
      automaticThought: decrypt(r.automaticThoughtEnc, s.key),
      evidenceFor: r.evidenceForEnc ? decrypt(r.evidenceForEnc, s.key) : null,
      evidenceAgainst: r.evidenceAgainstEnc ? decrypt(r.evidenceAgainstEnc, s.key) : null,
      balancedThought: r.balancedThoughtEnc ? decrypt(r.balancedThoughtEnc, s.key) : null,
      emotion: r.emotionEnc ? decrypt(r.emotionEnc, s.key) : null,
      intensityBefore: r.intensityBefore, intensityAfter: r.intensityAfter,
      distortions: r.distortions, createdAt: r.createdAt,
    })),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="dildi-export-${Date.now()}.json"`,
    },
  });
}
