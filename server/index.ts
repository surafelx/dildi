import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { collections, toId, CalendarKind } from "@/lib/models";
import { oid } from "@/lib/db";
import { newSalt, deriveKey, makeVerifier, checkVerifier, encrypt, decrypt, keyToString, keyFromString } from "@/lib/crypto";
import { hashPassword, verifyPassword } from "@/lib/password";
import { audit } from "@/lib/audit";
import { runCrisisCheck } from "@/lib/crisis-handler";
import { CRISIS_RESOURCES } from "@/lib/crisis";
import { chatReply, ChatTurn, weeklyNarrative } from "@/lib/llm";
import { computeBridge } from "@/lib/bridge";
import { listUpcomingEvents, createEvent } from "@/lib/google-calendar";

const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-change-me";
const PORT = Number(process.env.PORT || 4000);

// ── app ───────────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true }));
app.use(express.json({ limit: "2mb" }));

// ── helpers ────────────────────────────────────────────────────────────────
interface Authed extends Request { auth?: { userId: string; key: Buffer } }

function signToken(userId: string, keyB64: string) {
  return jwt.sign({ uid: userId, k: keyB64 }, JWT_SECRET, { expiresIn: "8h" });
}

function requireAuth(req: Authed, res: Response, next: NextFunction) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "unauthorized" });
  try {
    const p = jwt.verify(token, JWT_SECRET) as any;
    req.auth = { userId: p.uid, key: keyFromString(p.k) };
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

function dayStart(d: Date = new Date()): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

async function isLocked(userId: string): Promise<boolean> {
  const users = await collections.users();
  const u = await users.findOne({ _id: oid(userId)! }, { projection: { crisisLockedUntil: 1 } });
  return !!u?.crisisLockedUntil && u.crisisLockedUntil > new Date();
}

const wrap = (fn: (req: Authed, res: Response) => Promise<any>) =>
  (req: Authed, res: Response) => fn(req, res).catch((e) => {
    console.error("[api]", e?.message ?? e);
    res.status(500).json({ error: "server_error" });
  });

// ── health ───────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.json({ ok: true, service: "dildi-api" }));
app.get("/health", (_req, res) => res.json({ ok: true }));

// ── auth ─────────────────────────────────────────────────────────────────
const regSchema = z.object({ email: z.string().email(), name: z.string().min(1).max(120).optional(), password: z.string().min(10) });

app.post("/auth/register", wrap(async (req, res) => {
  const p = regSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const { email, name, password } = p.data;
  const users = await collections.users();
  if (await users.findOne({ email: email.toLowerCase() })) return res.status(409).json({ error: "Email already registered" });
  const encSalt = newSalt();
  const key = deriveKey(password, encSalt);
  const now = new Date();
  const r = await users.insertOne({
    email: email.toLowerCase(), name: name ?? null, passwordHash: hashPassword(password),
    encSalt, encVerifier: makeVerifier(key), biometricEnabled: true, inactivityLockSeconds: 300,
    allowAiTraining: false, companionPersonality: "warm", emergencyContactName: null, emergencyContactPhone: null,
    emergencyContactTelegram: null, crisisLockedUntil: null, telegramChatId: null, createdAt: now, updatedAt: now,
  });
  const uid = r.insertedId.toHexString();
  res.json({ token: signToken(uid, keyToString(key)), user: { id: uid, email: email.toLowerCase(), name: name ?? null } });
}));

app.post("/auth/login", wrap(async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: "missing credentials" });
  const users = await collections.users();
  const user = await users.findOne({ email: String(email).toLowerCase() });
  if (!user || !verifyPassword(password, user.passwordHash)) return res.status(401).json({ error: "Invalid email or password" });
  const key = deriveKey(password, user.encSalt);
  if (!checkVerifier(user.encVerifier, key)) return res.status(401).json({ error: "Invalid email or password" });
  const uid = user._id!.toHexString();
  res.json({ token: signToken(uid, keyToString(key)), user: { id: uid, email: user.email, name: user.name } });
}));

app.get("/auth/me", requireAuth, wrap(async (req, res) => {
  const users = await collections.users();
  const u = await users.findOne({ _id: oid(req.auth!.userId)! }, { projection: { email: 1, name: 1 } });
  res.json({ user: u ? { id: toId(u._id), email: u.email, name: u.name } : null });
}));

// ── mood ─────────────────────────────────────────────────────────────────
const slider = z.number().int().min(1).max(10);
const moodSchema = z.object({ mood: slider, anxiety: slider, energy: slider, sleepQuality: slider, sleepHours: z.number().min(0).max(14), date: z.string().datetime().optional() });

app.get("/mood", requireAuth, wrap(async (req, res) => {
  const days = Number(req.query.days ?? 30);
  const since = new Date(); since.setDate(since.getDate() - days);
  const col = await collections.moodLogs();
  const rows = await col.find({ userId: oid(req.auth!.userId)!, date: { $gte: dayStart(since) } }).sort({ date: 1 }).toArray();
  res.json({ logs: rows.map((m) => ({ ...m, id: toId(m._id), _id: undefined })) });
}));

app.post("/mood", requireAuth, wrap(async (req, res) => {
  const p = moodSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const { date, ...vals } = p.data;
  const day = dayStart(date ? new Date(date) : new Date());
  const col = await collections.moodLogs();
  await col.updateOne(
    { userId: oid(req.auth!.userId)!, date: day },
    { $set: { ...vals }, $setOnInsert: { userId: oid(req.auth!.userId)!, date: day, createdAt: new Date() } },
    { upsert: true },
  );
  res.json({ ok: true });
}));

// ── activities ─────────────────────────────────────────────────────────────
const actSchema = z.object({ type: z.enum(["EXERCISE", "MEDITATION", "SOCIAL", "THERAPY", "OTHER"]), note: z.string().max(2000).optional(), occurredAt: z.string().datetime().optional() });

app.get("/activities", requireAuth, wrap(async (req, res) => {
  const days = Number(req.query.days ?? 14);
  const since = new Date(); since.setDate(since.getDate() - days);
  const col = await collections.activities();
  const rows = await col.find({ userId: oid(req.auth!.userId)!, occurredAt: { $gte: since } }).sort({ occurredAt: -1 }).toArray();
  res.json({ activities: rows.map((a) => ({ id: toId(a._id), type: a.type, occurredAt: a.occurredAt, note: a.note ? decrypt(a.note, req.auth!.key) : null })) });
}));

app.post("/activities", requireAuth, wrap(async (req, res) => {
  const p = actSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const col = await collections.activities();
  const r = await col.insertOne({ userId: oid(req.auth!.userId)!, type: p.data.type, note: p.data.note ? encrypt(p.data.note, req.auth!.key) : null, occurredAt: p.data.occurredAt ? new Date(p.data.occurredAt) : new Date() });
  res.json({ id: r.insertedId.toHexString() });
}));

// ── journal ─────────────────────────────────────────────────────────────────
const jrnSchema = z.object({ title: z.string().max(200).optional(), body: z.string().min(1).max(50000), moodTags: z.array(z.string().max(40)).max(20).optional(), date: z.string().datetime().optional() });

app.get("/journal", requireAuth, wrap(async (req, res) => {
  const filter: any = { userId: oid(req.auth!.userId)! };
  if (req.query.date) filter.date = dayStart(new Date(String(req.query.date)));
  const col = await collections.journalEntries();
  const rows = await col.find(filter).sort({ date: -1 }).limit(200).toArray();
  await audit(req.auth!.userId, "journal.read", `count:${rows.length}`);
  res.json({ entries: rows.map((e) => ({ id: toId(e._id), date: e.date, title: e.titleEnc ? decrypt(e.titleEnc, req.auth!.key) : null, body: decrypt(e.bodyEnc, req.auth!.key), moodTags: e.moodTags, createdAt: e.createdAt, updatedAt: e.updatedAt })) });
}));

app.post("/journal", requireAuth, wrap(async (req, res) => {
  if (await isLocked(req.auth!.userId)) return res.status(423).json({ error: "crisis_locked" });
  const p = jrnSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const { title, body, moodTags, date } = p.data;
  const crisis = await runCrisisCheck(req.auth!.userId, `${title ?? ""}\n${body}`, "journal");
  if (crisis.triggered) return res.status(423).json({ error: "crisis_locked", crisis: { categories: crisis.categories, lockedUntil: crisis.lockedUntil } });
  const day = dayStart(date ? new Date(date) : new Date());
  const moodLogs = await collections.moodLogs();
  const linked = await moodLogs.findOne({ userId: oid(req.auth!.userId)!, date: day }, { projection: { _id: 1 } });
  const col = await collections.journalEntries();
  const now = new Date();
  const r = await col.insertOne({ userId: oid(req.auth!.userId)!, date: day, titleEnc: title ? encrypt(title, req.auth!.key) : null, bodyEnc: encrypt(body, req.auth!.key), moodTags: moodTags ?? [], linkedMoodId: linked?._id ?? null, createdAt: now, updatedAt: now });
  await audit(req.auth!.userId, "journal.create", `entry:${r.insertedId.toHexString()}`);
  res.json({ id: r.insertedId.toHexString() });
}));

// ── chat ─────────────────────────────────────────────────────────────────
app.get("/chat", requireAuth, wrap(async (req, res) => {
  const convos = await collections.chatConversations();
  if (!req.query.conversationId) {
    const rows = await convos.find({ userId: oid(req.auth!.userId)! }).sort({ updatedAt: -1 }).toArray();
    return res.json({ conversations: rows.map((c) => ({ id: toId(c._id), title: c.title, updatedAt: c.updatedAt })) });
  }
  const cId = oid(String(req.query.conversationId));
  const convo = cId ? await convos.findOne({ _id: cId, userId: oid(req.auth!.userId)! }) : null;
  if (!convo) return res.status(404).json({ error: "not_found" });
  const msgs = await collections.chatMessages();
  const rows = await msgs.find({ conversationId: convo._id! }).sort({ createdAt: 1 }).toArray();
  await audit(req.auth!.userId, "chat.read", `conversation:${toId(convo._id)}`);
  res.json({ id: toId(convo._id), title: convo.title, messages: rows.map((m) => ({ id: toId(m._id), role: m.role, content: decrypt(m.contentEnc, req.auth!.key), createdAt: m.createdAt })) });
}));

app.post("/chat", requireAuth, wrap(async (req, res) => {
  if (await isLocked(req.auth!.userId)) return res.status(423).json({ error: "crisis_locked" });
  const { conversationId, message } = req.body ?? {};
  if (!message || typeof message !== "string") return res.status(400).json({ error: "message required" });
  const crisis = await runCrisisCheck(req.auth!.userId, message, "chat");
  if (crisis.triggered) return res.status(423).json({ error: "crisis_locked", crisis: { categories: crisis.categories, lockedUntil: crisis.lockedUntil } });

  const convos = await collections.chatConversations();
  const msgs = await collections.chatMessages();
  const cId = conversationId ? oid(conversationId) : null;
  let convo = cId ? await convos.findOne({ _id: cId, userId: oid(req.auth!.userId)! }) : null;
  if (!convo) {
    const now = new Date();
    const r = await convos.insertOne({ userId: oid(req.auth!.userId)!, openAiThreadId: null, title: message.slice(0, 40), createdAt: now, updatedAt: now });
    convo = { _id: r.insertedId, userId: oid(req.auth!.userId)!, openAiThreadId: null, title: message.slice(0, 40), createdAt: now, updatedAt: now };
  }
  const prior = await msgs.find({ conversationId: convo._id! }).sort({ createdAt: 1 }).toArray();
  await audit(req.auth!.userId, "chat.decrypt", `conversation:${toId(convo._id)}`);
  const history: ChatTurn[] = prior.slice(-20).map((m) => ({ role: m.role === "USER" ? "user" : "assistant", content: decrypt(m.contentEnc, req.auth!.key) }));
  history.push({ role: "user", content: message });
  await msgs.insertOne({ conversationId: convo._id!, role: "USER", contentEnc: encrypt(message, req.auth!.key), flaggedCrisis: false, createdAt: new Date() });

  const me = await (await collections.users()).findOne({ _id: oid(req.auth!.userId)! }, { projection: { companionPersonality: 1 } });
  let reply = "";
  try { reply = await chatReply(history, me?.companionPersonality); }
  catch (e) { console.error("[chat] llm", (e as any)?.message); return res.status(502).json({ error: "assistant_error" }); }
  await msgs.insertOne({ conversationId: convo._id!, role: "ASSISTANT", contentEnc: encrypt(reply, req.auth!.key), flaggedCrisis: false, createdAt: new Date() });
  await convos.updateOne({ _id: convo._id! }, { $set: { updatedAt: new Date() } });
  res.json({ conversationId: toId(convo._id), reply });
}));

// ── calendar ─────────────────────────────────────────────────────────────
function classify(t: string): CalendarKind { if (/therap|counsel|session/i.test(t)) return "THERAPY"; if (/check[\s-]?in|mood/i.test(t)) return "CHECKIN_REMINDER"; return "OTHER"; }

app.get("/calendar", requireAuth, wrap(async (req, res) => {
  const col = await collections.calendarEvents();
  try {
    for (const g of await listUpcomingEvents()) {
      await col.updateOne({ googleEventId: g.googleEventId },
        { $set: { title: g.title, start: g.start, end: g.end, location: g.location, kind: classify(g.title), syncedAt: new Date() }, $setOnInsert: { userId: oid(req.auth!.userId)!, googleEventId: g.googleEventId } },
        { upsert: true });
    }
  } catch (e) { console.warn("[calendar] sync skipped:", (e as any)?.message); }
  const rows = await col.find({ userId: oid(req.auth!.userId)!, start: { $gte: new Date(Date.now() - 86400000) } }).sort({ start: 1 }).toArray();
  res.json({ events: rows.map((e) => ({ ...e, id: toId(e._id), _id: undefined })) });
}));

// ── insights ─────────────────────────────────────────────────────────────
app.get("/insights", requireAuth, wrap(async (req, res) => {
  const userId = oid(req.auth!.userId)!;
  const range = String(req.query.range ?? "week");
  const days = range === "year" ? 365 : range === "month" ? 30 : 7;
  const since = new Date(); since.setDate(since.getDate() - days);
  const [moodCol, actCol, jrnCol] = await Promise.all([collections.moodLogs(), collections.activities(), collections.journalEntries()]);
  const [moods, activities, journals] = await Promise.all([
    moodCol.find({ userId, date: { $gte: since } }).sort({ date: 1 }).toArray(),
    actCol.find({ userId, occurredAt: { $gte: since } }).toArray(),
    jrnCol.find({ userId, date: { $gte: since } }).sort({ date: 1 }).toArray(),
  ]);
  const activityCounts: Record<string, number> = {};
  for (const a of activities) activityCounts[a.type] = (activityCounts[a.type] ?? 0) + 1;
  const avg = (k: any) => moods.length ? +(moods.reduce((t, m) => t + (m as any)[k], 0) / moods.length).toFixed(1) : null;
  const summary = { averages: { mood: avg("mood"), anxiety: avg("anxiety"), energy: avg("energy"), sleepQuality: avg("sleepQuality"), sleepHours: avg("sleepHours") }, activityCounts, checkInCount: moods.length, journalCount: journals.length };
  const tagCounts: Record<string, number> = {};
  for (const j of journals) for (const t of j.moodTags ?? []) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  const total = Object.values(tagCounts).reduce((a, b) => a + b, 0);
  const topEmotions = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, n]) => ({ label: label.charAt(0).toUpperCase() + label.slice(1), pct: Math.round((n / total) * 100) }));
  await audit(req.auth!.userId, "insights.generate", `journals:${journals.length}`);
  let narrative = "";
  try {
    const snippets = journals.map((j) => decrypt(j.bodyEnc, req.auth!.key).slice(0, 300)).join("\n---\n");
    narrative = await weeklyNarrative([`Mood over ${days}d: ${moods.map((m) => m.mood).join(", ") || "no data"}.`, `Averages: ${JSON.stringify(summary.averages)}.`, `Activities: ${JSON.stringify(activityCounts)}.`, snippets ? `Journal excerpts:\n${snippets}` : "No journal entries."].join("\n"));
  } catch (e) { narrative = "Your reflection couldn't be generated right now — your data is safe."; }
  res.json({ summary, moods, narrative, topEmotions, range });
}));

// ── crisis ─────────────────────────────────────────────────────────────────
app.get("/crisis", requireAuth, wrap(async (req, res) => {
  const users = await collections.users();
  const u = await users.findOne({ _id: oid(req.auth!.userId)! }, { projection: { crisisLockedUntil: 1, emergencyContactName: 1 } });
  res.json({ locked: !!u?.crisisLockedUntil && u.crisisLockedUntil > new Date(), lockedUntil: u?.crisisLockedUntil ?? null, emergencyContactName: u?.emergencyContactName ?? null, resources: CRISIS_RESOURCES });
}));

app.post("/crisis", requireAuth, wrap(async (req, res) => {
  const userId = oid(req.auth!.userId)!;
  await (await collections.users()).updateOne({ _id: userId }, { $set: { crisisLockedUntil: null } });
  await (await collections.crisisAlerts()).updateMany({ userId, status: { $ne: "RESOLVED" } }, { $set: { status: "RESOLVED", resolvedAt: new Date() } });
  res.json({ ok: true });
}));

// ── settings ─────────────────────────────────────────────────────────────
const setSchema = z.object({ name: z.string().max(120).optional(), biometricEnabled: z.boolean().optional(), inactivityLockSeconds: z.number().int().min(30).max(3600).optional(), companionPersonality: z.string().max(20).optional(), emergencyContactName: z.string().max(120).optional(), emergencyContactPhone: z.string().max(40).optional(), emergencyContactTelegram: z.string().max(64).optional() });

app.get("/settings", requireAuth, wrap(async (req, res) => {
  const users = await collections.users();
  const u = await users.findOne({ _id: oid(req.auth!.userId)! }, { projection: { name: 1, email: 1, biometricEnabled: 1, inactivityLockSeconds: 1, allowAiTraining: 1, companionPersonality: 1, emergencyContactName: 1, emergencyContactPhone: 1, emergencyContactTelegram: 1 } });
  res.json({ user: u ? { ...u, _id: undefined } : null });
}));

app.patch("/settings", requireAuth, wrap(async (req, res) => {
  const p = setSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  await (await collections.users()).updateOne({ _id: oid(req.auth!.userId)! }, { $set: { ...p.data, updatedAt: new Date() } });
  res.json({ ok: true });
}));

// ── bridge ─────────────────────────────────────────────────────────────────
app.get("/bridge", requireAuth, wrap(async (req, res) => {
  const userId = oid(req.auth!.userId)!;
  const [moodC, actC, jrnC, trC, cbtC] = await Promise.all([collections.moodLogs(), collections.activities(), collections.journalEntries(), collections.thoughtRecords(), collections.cbtProgress()]);
  const [moodDocs, activities, journalDocs, thoughtRecords, cbt] = await Promise.all([
    moodC.find({ userId }, { projection: { date: 1 } }).toArray(),
    actC.countDocuments({ userId }),
    jrnC.find({ userId }, { projection: { date: 1 } }).toArray(),
    trC.countDocuments({ userId }),
    cbtC.findOne({ userId }, { projection: { completedModules: 1 } }),
  ]);
  res.json(computeBridge({ moods: moodDocs.length, journals: journalDocs.length, activities, thoughtRecords, modulesCompleted: cbt?.completedModules?.length ?? 0, checkinDates: moodDocs.map((m) => m.date.toISOString()), journalDates: journalDocs.map((j) => j.date.toISOString()) }));
}));

// ── program ─────────────────────────────────────────────────────────────────
app.get("/program", requireAuth, wrap(async (req, res) => {
  const doc = await (await collections.cbtProgress()).findOne({ userId: oid(req.auth!.userId)! });
  res.json({ completedModules: doc?.completedModules ?? [] });
}));
app.post("/program", requireAuth, wrap(async (req, res) => {
  const { moduleId, completed = true } = req.body ?? {};
  if (!moduleId) return res.status(400).json({ error: "moduleId required" });
  const col = await collections.cbtProgress();
  const userId = oid(req.auth!.userId)!;
  await col.updateOne({ userId }, { ...(completed ? { $addToSet: { completedModules: moduleId } } : { $pull: { completedModules: moduleId } }), $set: { updatedAt: new Date() }, $setOnInsert: { userId } }, { upsert: true });
  const doc = await col.findOne({ userId });
  res.json({ completedModules: doc?.completedModules ?? [] });
}));

// ── thought records ─────────────────────────────────────────────────────────
const trSchema = z.object({ moduleId: z.string().max(64).optional(), situation: z.string().min(1).max(5000), emotion: z.string().max(200).optional(), intensityBefore: z.number().int().min(0).max(100), automaticThought: z.string().min(1).max(5000), distortions: z.array(z.string().max(40)).max(20).optional(), evidenceFor: z.string().max(5000).optional(), evidenceAgainst: z.string().max(5000).optional(), balancedThought: z.string().max(5000).optional(), intensityAfter: z.number().int().min(0).max(100).optional() });

app.get("/thought-records", requireAuth, wrap(async (req, res) => {
  const rows = await (await collections.thoughtRecords()).find({ userId: oid(req.auth!.userId)! }).sort({ createdAt: -1 }).limit(100).toArray();
  await audit(req.auth!.userId, "thoughtRecord.read", `count:${rows.length}`);
  const k = req.auth!.key;
  res.json({ records: rows.map((r) => ({ id: toId(r._id), moduleId: r.moduleId, situation: decrypt(r.situationEnc, k), automaticThought: decrypt(r.automaticThoughtEnc, k), evidenceFor: r.evidenceForEnc ? decrypt(r.evidenceForEnc, k) : null, evidenceAgainst: r.evidenceAgainstEnc ? decrypt(r.evidenceAgainstEnc, k) : null, balancedThought: r.balancedThoughtEnc ? decrypt(r.balancedThoughtEnc, k) : null, emotion: r.emotionEnc ? decrypt(r.emotionEnc, k) : null, intensityBefore: r.intensityBefore, intensityAfter: r.intensityAfter, distortions: r.distortions, createdAt: r.createdAt })) });
}));

app.post("/thought-records", requireAuth, wrap(async (req, res) => {
  if (await isLocked(req.auth!.userId)) return res.status(423).json({ error: "crisis_locked" });
  const p = trSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const d = p.data; const k = req.auth!.key;
  const blob = [d.situation, d.automaticThought, d.evidenceFor, d.evidenceAgainst, d.balancedThought].filter(Boolean).join("\n");
  const crisis = await runCrisisCheck(req.auth!.userId, blob, "journal");
  if (crisis.triggered) return res.status(423).json({ error: "crisis_locked", crisis: { categories: crisis.categories, lockedUntil: crisis.lockedUntil } });
  const r = await (await collections.thoughtRecords()).insertOne({ userId: oid(req.auth!.userId)!, moduleId: d.moduleId ?? null, situationEnc: encrypt(d.situation, k), automaticThoughtEnc: encrypt(d.automaticThought, k), evidenceForEnc: d.evidenceFor ? encrypt(d.evidenceFor, k) : null, evidenceAgainstEnc: d.evidenceAgainst ? encrypt(d.evidenceAgainst, k) : null, balancedThoughtEnc: d.balancedThought ? encrypt(d.balancedThought, k) : null, emotionEnc: d.emotion ? encrypt(d.emotion, k) : null, intensityBefore: d.intensityBefore, intensityAfter: d.intensityAfter ?? null, distortions: d.distortions ?? [], createdAt: new Date() });
  await audit(req.auth!.userId, "thoughtRecord.create", `record:${r.insertedId.toHexString()}`);
  res.json({ id: r.insertedId.toHexString() });
}));

// ── export / delete ─────────────────────────────────────────────────────────
app.get("/export", requireAuth, wrap(async (req, res) => {
  const userId = oid(req.auth!.userId)!; const k = req.auth!.key;
  const [usersC, moodC, actC, jrnC, calC, convC, msgC, goalC, trC] = await Promise.all([collections.users(), collections.moodLogs(), collections.activities(), collections.journalEntries(), collections.calendarEvents(), collections.chatConversations(), collections.chatMessages(), collections.goals(), collections.thoughtRecords()]);
  const [user, moods, activities, journals, calendar, conversations, goals, trs] = await Promise.all([
    usersC.findOne({ _id: userId }, { projection: { passwordHash: 0, encSalt: 0, encVerifier: 0 } }),
    moodC.find({ userId }).toArray(), actC.find({ userId }).toArray(), jrnC.find({ userId }).toArray(),
    calC.find({ userId }).toArray(), convC.find({ userId }).toArray(), goalC.find({ userId }).toArray(), trC.find({ userId }).toArray(),
  ]);
  const conversationsOut = [];
  for (const c of conversations) {
    const m = await msgC.find({ conversationId: c._id! }).sort({ createdAt: 1 }).toArray();
    conversationsOut.push({ id: toId(c._id), title: c.title, createdAt: c.createdAt, messages: m.map((x) => ({ role: x.role, content: decrypt(x.contentEnc, k), createdAt: x.createdAt })) });
  }
  await audit(req.auth!.userId, "export.create", "full");
  const payload = {
    exportedAt: new Date().toISOString(),
    user: user ? { ...user, id: toId(user._id), _id: undefined } : null,
    moodLogs: moods.map((m) => ({ ...m, id: toId(m._id), _id: undefined })),
    activities: activities.map((a) => ({ id: toId(a._id), type: a.type, occurredAt: a.occurredAt, note: a.note ? decrypt(a.note, k) : null })),
    journalEntries: journals.map((j) => ({ id: toId(j._id), date: j.date, title: j.titleEnc ? decrypt(j.titleEnc, k) : null, body: decrypt(j.bodyEnc, k), moodTags: j.moodTags, createdAt: j.createdAt })),
    calendar: calendar.map((e) => ({ ...e, id: toId(e._id), _id: undefined })),
    conversations: conversationsOut,
    goals: goals.map((g) => ({ ...g, id: toId(g._id), _id: undefined })),
    thoughtRecords: trs.map((r) => ({ id: toId(r._id), situation: decrypt(r.situationEnc, k), automaticThought: decrypt(r.automaticThoughtEnc, k), balancedThought: r.balancedThoughtEnc ? decrypt(r.balancedThoughtEnc, k) : null, intensityBefore: r.intensityBefore, intensityAfter: r.intensityAfter, createdAt: r.createdAt })),
  };
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="dildi-export-${Date.now()}.json"`);
  res.send(JSON.stringify(payload, null, 2));
}));

const delSchema = z.object({ password: z.string(), confirm: z.literal("DELETE") });
app.post("/delete", requireAuth, wrap(async (req, res) => {
  const p = delSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Confirmation required" });
  const userId = oid(req.auth!.userId)!;
  const users = await collections.users();
  const user = await users.findOne({ _id: userId });
  if (!user || !verifyPassword(p.data.password, user.passwordHash)) return res.status(403).json({ error: "Incorrect password" });
  const convC = await collections.chatConversations();
  const convoIds = (await convC.find({ userId }, { projection: { _id: 1 } }).toArray()).map((c) => c._id!);
  const [moodC, actC, jrnC, calC, msgC, crisisC, goalC, auditC, trC, cbtC] = await Promise.all([collections.moodLogs(), collections.activities(), collections.journalEntries(), collections.calendarEvents(), collections.chatMessages(), collections.crisisAlerts(), collections.goals(), collections.auditLogs(), collections.thoughtRecords(), collections.cbtProgress()]);
  await Promise.all([moodC.deleteMany({ userId }), actC.deleteMany({ userId }), jrnC.deleteMany({ userId }), calC.deleteMany({ userId }), msgC.deleteMany({ conversationId: { $in: convoIds } }), convC.deleteMany({ userId }), crisisC.deleteMany({ userId }), goalC.deleteMany({ userId }), auditC.deleteMany({ userId }), trC.deleteMany({ userId }), cbtC.deleteMany({ userId })]);
  await users.deleteOne({ _id: userId });
  res.json({ ok: true, deleted: true });
}));

app.listen(PORT, () => console.log(`✓ Dildi API listening on :${PORT}`));
