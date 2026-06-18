import { NextResponse } from "next/server";
import { z } from "zod";
import { collections, toId } from "@/lib/models";
import { oid } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { encrypt, decrypt } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { crisisLockResponse } from "@/lib/guard";
import { runCrisisCheck } from "@/lib/crisis-handler";
import { chatReply, ChatTurn } from "@/lib/llm";

// GET /api/chat?conversationId=... -> messages (decrypted). No id -> list convos.
export async function GET(req: Request) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const convoId = new URL(req.url).searchParams.get("conversationId");
  const convos = await collections.chatConversations();

  if (!convoId) {
    const rows = await convos
      .find({ userId: oid(s.userId)! })
      .sort({ updatedAt: -1 })
      .toArray();
    const conversations = rows.map((c) => ({ id: toId(c._id), title: c.title, updatedAt: c.updatedAt }));
    return NextResponse.json({ conversations });
  }

  const cId = oid(convoId);
  const convo = cId ? await convos.findOne({ _id: cId, userId: oid(s.userId)! }) : null;
  if (!convo) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const msgs = await collections.chatMessages();
  const rows = await msgs.find({ conversationId: convo._id! }).sort({ createdAt: 1 }).toArray();
  await audit(s.userId, "chat.read", `conversation:${toId(convo._id)}`);
  const messages = rows.map((m) => ({
    id: toId(m._id),
    role: m.role,
    content: decrypt(m.contentEnc, s.key),
    createdAt: m.createdAt,
  }));
  return NextResponse.json({ id: toId(convo._id), title: convo.title, messages });
}

const schema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(8000),
});

export async function POST(req: Request) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const locked = await crisisLockResponse(s.userId);
  if (locked) return locked;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { conversationId, message } = parsed.data;

  // 1) Crisis scan FIRST. If triggered, lock and do not call the model.
  const crisis = await runCrisisCheck(s.userId, message, "chat");
  if (crisis.triggered) {
    return NextResponse.json(
      { error: "crisis_locked", crisis: { categories: crisis.categories, lockedUntil: crisis.lockedUntil } },
      { status: 423 },
    );
  }

  // 2) Resolve / create conversation. Memory = our own stored history (no
  //    OpenAI threads — OpenRouter is chat-completions only).
  const convos = await collections.chatConversations();
  const msgs = await collections.chatMessages();
  const cId = conversationId ? oid(conversationId) : null;
  let convo = cId ? await convos.findOne({ _id: cId, userId: oid(s.userId)! }) : null;

  if (!convo) {
    const now = new Date();
    const res = await convos.insertOne({
      userId: oid(s.userId)!,
      openAiThreadId: null,
      title: message.slice(0, 40),
      createdAt: now,
      updatedAt: now,
    });
    convo = { _id: res.insertedId, userId: oid(s.userId)!, openAiThreadId: null, title: message.slice(0, 40), createdAt: now, updatedAt: now };
  }

  // 3) Rebuild conversation memory from stored (encrypted) messages.
  const priorDocs = await msgs
    .find({ conversationId: convo._id! })
    .sort({ createdAt: 1 })
    .toArray();
  await audit(s.userId, "chat.decrypt", `conversation:${toId(convo._id)}`);
  const history: ChatTurn[] = priorDocs
    .slice(-20) // bound context window
    .map((m) => ({ role: m.role === "USER" ? "user" : "assistant", content: decrypt(m.contentEnc, s.key) }));
  history.push({ role: "user", content: message });

  // 4) Store the user message (encrypted) and generate the reply.
  await msgs.insertOne({
    conversationId: convo._id!,
    role: "USER",
    contentEnc: encrypt(message, s.key),
    flaggedCrisis: false,
    createdAt: new Date(),
  });

  let reply = "";
  try {
    reply = await chatReply(history);
  } catch (e) {
    console.error("[chat] llm error", e);
    return NextResponse.json({ error: "assistant_error" }, { status: 502 });
  }

  await msgs.insertOne({
    conversationId: convo._id!,
    role: "ASSISTANT",
    contentEnc: encrypt(reply, s.key),
    flaggedCrisis: false,
    createdAt: new Date(),
  });
  await convos.updateOne({ _id: convo._id! }, { $set: { updatedAt: new Date() } });

  return NextResponse.json({ conversationId: toId(convo._id), reply });
}
