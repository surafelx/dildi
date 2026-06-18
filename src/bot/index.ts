import "dotenv/config";
import TelegramBot, { InlineKeyboardButton } from "node-telegram-bot-api";
import { collections, toId } from "@/lib/models";
import { oid } from "@/lib/db";
import { newSalt, deriveKey, makeVerifier, checkVerifier, encrypt, decrypt } from "@/lib/crypto";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { runCrisisCheck } from "@/lib/crisis-handler";
import { CRISIS_RESOURCES } from "@/lib/crisis";
import { chatReply, ChatTurn } from "@/lib/llm";
import { audit } from "@/lib/audit";
import {
  getSession, startSession, touch, endSession, getPending, setPending,
  getAnchor, setAnchor,
} from "./session";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN || TOKEN === "REPLACE_ME") {
  console.error("✗ TELEGRAM_BOT_TOKEN is missing. Set it in .env (from @BotFather).");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// Register the Telegram command menu (the blue ☰ button next to the input).
bot.setMyCommands([
  { command: "menu", description: "Open the Dildi menu" },
  { command: "logout", description: "Sign out & wipe your key from memory" },
  { command: "help", description: "How this bot works" },
]).catch((e) => console.warn("setMyCommands failed:", e?.message));

console.log("✓ Dildi Telegram bot started (single-message UI, long polling).");

type KB = InlineKeyboardButton[][];

// ── single-anchor renderer ───────────────────────────────────────────────
/** Edit the chat's one anchor message in place; create it if missing. */
async function render(chatId: number, text: string, keyboard?: KB) {
  const reply_markup = keyboard ? { inline_keyboard: keyboard } : undefined;
  const anchorId = getAnchor(chatId);
  if (anchorId != null) {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId, message_id: anchorId,
        parse_mode: "Markdown", reply_markup,
      });
      return;
    } catch (e: any) {
      const desc = e?.response?.body?.description ?? "";
      if (desc.includes("message is not modified")) return; // no-op edit
      // anchor gone/uneditable → fall through and create a fresh one
    }
  }
  const m = await bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup });
  setAnchor(chatId, m.message_id);
}

/** Delete a user's input message so the chat stays a single living screen. */
function sweep(chatId: number, messageId?: number) {
  if (messageId != null) bot.deleteMessage(chatId, messageId).catch(() => {});
}

// ── screens ──────────────────────────────────────────────────────────────
const BACK: KB = [[{ text: "← Menu", callback_data: "nav:home" }]];

async function showHome(chatId: number) {
  const s = getSession(chatId);
  if (!s) {
    await render(
      chatId,
      "🌿 *Dildi*\nA calm, private space for your wellbeing.\n\n" +
        "Your journal and chats are encrypted with a key derived from your password.\n\n" +
        "New here? Create an account. Already have one? Sign in.",
      [
        [{ text: "🔑 Sign in", callback_data: "nav:login" }],
        [{ text: "✨ Create account", callback_data: "nav:register" }],
      ],
    );
    return;
  }
  if (await isLocked(s.userId)) return showCrisis(chatId);
  await render(
    chatId,
    "🌿 *Dildi*\nHow are you arriving today?\n\nPick something below — or just type to talk to me.",
    [
      [
        { text: "🙂 Check-in", callback_data: "nav:mood" },
        { text: "📓 Journal", callback_data: "nav:journal" },
      ],
      [
        { text: "✅ Activity", callback_data: "nav:activity" },
        { text: "📊 Insights", callback_data: "nav:insights" },
      ],
      [{ text: "💬 Talk to companion", callback_data: "nav:chat" }],
      [{ text: "Sign out", callback_data: "nav:logout" }],
    ],
  );
}

async function showCrisis(chatId: number) {
  await render(
    chatId,
    "🫶 *You matter, and you're not alone.*\n\n" +
      "It sounds like you're going through something really hard. Please reach " +
      "out — people are ready to help, any time:\n\n" +
      CRISIS_RESOURCES.map((r) => `• *${r.label}*\n  ${r.value}`).join("\n") +
      "\n\nIf you're in immediate danger, call your local emergency number now.",
    [[{ text: "I'm safe right now", callback_data: "crisis:ack" }]],
  );
}

// ── helpers ──────────────────────────────────────────────────────────────
async function isLocked(userId: string): Promise<boolean> {
  const users = await collections.users();
  const u = await users.findOne({ _id: oid(userId)! }, { projection: { crisisLockedUntil: 1 } });
  return !!u?.crisisLockedUntil && u.crisisLockedUntil > new Date();
}

async function clearLock(userId: string) {
  const users = await collections.users();
  const alerts = await collections.crisisAlerts();
  await users.updateOne({ _id: oid(userId)! }, { $set: { crisisLockedUntil: null } });
  await alerts.updateMany(
    { userId: oid(userId)!, status: { $ne: "RESOLVED" } },
    { $set: { status: "RESOLVED", resolvedAt: new Date() } },
  );
}

// ── slash commands (kept minimal; the UI is button-driven) ────────────────
bot.onText(/^\/(start|menu)\b/, (msg) => { setPending(msg.chat.id, undefined); showHome(msg.chat.id); });

bot.onText(/^\/help\b/, (msg) =>
  render(
    msg.chat.id,
    "*Dildi bot*\n\nEverything lives in one message that updates as you go — " +
      "tap the buttons to navigate. Use /menu anytime to return home, /logout to sign out.\n\n" +
      "Your journal & chats are encrypted; your password (typed during sign-in) is deleted " +
      "right after and never stored.",
    BACK,
  ),
);

bot.onText(/^\/logout\b/, (msg) => {
  endSession(msg.chat.id);
  setPending(msg.chat.id, undefined);
  showHome(msg.chat.id);
});

// ── inline button taps ────────────────────────────────────────────────────
bot.on("callback_query", async (q) => {
  const chatId = q.message?.chat.id;
  if (!chatId || !q.data) return;
  bot.answerCallbackQuery(q.id).catch(() => {});
  const [ns, arg] = q.data.split(":");

  if (ns === "crisis" && arg === "ack") {
    const s = getSession(chatId);
    if (s) await clearLock(s.userId);
    return showHome(chatId);
  }

  if (ns === "act") {
    const s = getSession(chatId);
    if (!s) return showHome(chatId);
    if (await isLocked(s.userId)) return showCrisis(chatId);
    const col = await collections.activities();
    await col.insertOne({ userId: oid(s.userId)!, type: arg as any, note: null, occurredAt: new Date() });
    touch(chatId);
    await render(chatId, `✅ Logged *${arg.toLowerCase()}*. Nice — that counts.`, BACK);
    return;
  }

  if (ns !== "nav") return;
  const s = getSession(chatId);

  switch (arg) {
    case "home": return showHome(chatId);
    case "login":
      setPending(chatId, { kind: "await_email" });
      return render(chatId, "🔑 *Sign in*\n\nSend me your email address.", BACK);
    case "register":
      setPending(chatId, { kind: "await_reg_email" });
      return render(chatId, "✨ *Create account*\n\nWhat email should we use?", BACK);
    case "logout":
      endSession(chatId);
      setPending(chatId, undefined);
      return showHome(chatId);
  }

  // The rest require a session.
  if (!s) return showHome(chatId);
  if (await isLocked(s.userId)) return showCrisis(chatId);

  switch (arg) {
    case "mood":
      setPending(chatId, { kind: "await_mood" });
      return render(
        chatId,
        "🙂 *Daily check-in*\n\nSend five numbers separated by spaces:\n" +
          "`mood anxiety energy sleepQuality sleepHours`\n" +
          "e.g. `7 4 6 8 7.5`  (first four 1–10, last is hours)",
        BACK,
      );
    case "journal":
      setPending(chatId, { kind: "await_journal" });
      return render(chatId, "📓 *Journal*\n\nType your entry — your next message is encrypted and saved. 🔒", BACK);
    case "activity":
      return render(chatId, "✅ *Log an activity*\n\nWhat did you do?", [
        [
          { text: "🏃 Exercise", callback_data: "act:EXERCISE" },
          { text: "🧘 Meditation", callback_data: "act:MEDITATION" },
        ],
        [
          { text: "👋 Social", callback_data: "act:SOCIAL" },
          { text: "🛋️ Therapy", callback_data: "act:THERAPY" },
        ],
        [{ text: "✨ Other", callback_data: "act:OTHER" }],
        ...BACK,
      ]);
    case "insights":
      return showInsights(chatId, s.userId);
    case "chat":
      setPending(chatId, { kind: "await_chat" });
      return render(chatId, "💬 *Companion*\n\nWhat's present for you right now? Just type — I'm listening.", BACK);
  }
});

// ── free-text input (drives the pending flows) ────────────────────────────
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text || text.startsWith("/")) return; // commands handled elsewhere

  const pending = getPending(chatId);

  // Register
  if (pending?.kind === "await_reg_email") {
    sweep(chatId, msg.message_id);
    const email = text.toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setPending(chatId, undefined);
      return render(chatId, "That doesn't look like an email. Tap below to try again.", [
        [{ text: "✨ Create account", callback_data: "nav:register" }], ...BACK,
      ]);
    }
    setPending(chatId, { kind: "await_reg_password", email });
    return render(chatId, "Pick a password (≥ 10 chars). I'll delete your message right after.\n\n⚠️ It encrypts your data and *cannot be reset* — keep it safe.", BACK);
  }
  if (pending?.kind === "await_reg_password") {
    sweep(chatId, msg.message_id);
    setPending(chatId, undefined);
    return handleRegister(chatId, pending.email, text);
  }

  // Login
  if (pending?.kind === "await_email") {
    sweep(chatId, msg.message_id);
    setPending(chatId, { kind: "await_password", email: text.toLowerCase() });
    return render(chatId, "And your password? (I'll delete the message right after.)", BACK);
  }
  if (pending?.kind === "await_password") {
    sweep(chatId, msg.message_id);
    setPending(chatId, undefined);
    return handleLogin(chatId, pending.email, text);
  }

  // From here on a session is required.
  const s = getSession(chatId);
  if (!s) { sweep(chatId, msg.message_id); return showHome(chatId); }
  touch(chatId);
  if (await isLocked(s.userId)) { sweep(chatId, msg.message_id); return showCrisis(chatId); }

  if (pending?.kind === "await_mood") {
    sweep(chatId, msg.message_id);
    setPending(chatId, undefined);
    return handleMood(chatId, s.userId, text);
  }
  if (pending?.kind === "await_journal") {
    sweep(chatId, msg.message_id);
    setPending(chatId, undefined);
    const crisis = await runCrisisCheck(s.userId, text, "journal");
    if (crisis.triggered) return showCrisis(chatId);
    const col = await collections.journalEntries();
    const day = new Date(); day.setHours(0, 0, 0, 0);
    const now = new Date();
    await col.insertOne({
      userId: oid(s.userId)!, date: day, titleEnc: null, bodyEnc: encrypt(text, s.key),
      moodTags: [], linkedMoodId: null, createdAt: now, updatedAt: now,
    });
    await audit(s.userId, "journal.create", "via-telegram");
    return render(chatId, "📓 Saved & encrypted. 🔒 Only you can read it back.", BACK);
  }

  // Default / await_chat: talk to the companion. Keep chatting until they exit.
  sweep(chatId, msg.message_id);
  setPending(chatId, { kind: "await_chat" });
  await handleChat(chatId, s.userId, s.key, text);
});

// ── action handlers ───────────────────────────────────────────────────────
async function handleRegister(chatId: number, email: string, password: string) {
  if (password.length < 10) {
    return render(chatId, "Password needs at least 10 characters.", [
      [{ text: "✨ Try again", callback_data: "nav:register" }], ...BACK,
    ]);
  }
  const users = await collections.users();
  if (await users.findOne({ email })) {
    return render(chatId, "That email is already registered.", [
      [{ text: "🔑 Sign in instead", callback_data: "nav:login" }], ...BACK,
    ]);
  }
  const encSalt = newSalt();
  const key = deriveKey(password, encSalt);
  const now = new Date();
  const res = await users.insertOne({
    email, name: null, passwordHash: hashPassword(password), encSalt,
    encVerifier: makeVerifier(key), biometricEnabled: true, inactivityLockSeconds: 300,
    allowAiTraining: false, emergencyContactName: null, emergencyContactPhone: null,
    emergencyContactTelegram: null, crisisLockedUntil: null, telegramChatId: String(chatId),
    createdAt: now, updatedAt: now,
  });
  startSession(chatId, toId(res.insertedId), key);
  return showHome(chatId);
}

async function handleLogin(chatId: number, email: string, password: string) {
  const users = await collections.users();
  const user = await users.findOne({ email });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return render(chatId, "Couldn't sign you in — check your details.", [
      [{ text: "🔑 Try again", callback_data: "nav:login" }],
      [{ text: "✨ Create account", callback_data: "nav:register" }],
    ]);
  }
  const key = deriveKey(password, user.encSalt);
  if (!checkVerifier(user.encVerifier, key)) {
    return render(chatId, "Couldn't unlock your encrypted data.", [
      [{ text: "🔑 Try again", callback_data: "nav:login" }],
    ]);
  }
  startSession(chatId, toId(user._id), key);
  await users.updateOne({ _id: user._id }, { $set: { telegramChatId: String(chatId) } });
  return showHome(chatId);
}

async function handleMood(chatId: number, userId: string, text: string) {
  const nums = text.split(/\s+/).map(Number);
  const bad = nums.length !== 5 || nums.some((n) => Number.isNaN(n));
  if (bad) {
    return render(chatId, "I need five numbers like `7 4 6 8 7.5`.", [
      [{ text: "🙂 Try again", callback_data: "nav:mood" }], ...BACK,
    ]);
  }
  const [mood, anxiety, energy, sleepQuality, sleepHours] = nums;
  const okScale = [mood, anxiety, energy, sleepQuality].every((n) => n >= 1 && n <= 10);
  if (!okScale || sleepHours < 0 || sleepHours > 14) {
    return render(chatId, "First four must be 1–10 and sleep hours 0–14.", [
      [{ text: "🙂 Try again", callback_data: "nav:mood" }], ...BACK,
    ]);
  }
  const col = await collections.moodLogs();
  const day = new Date(); day.setHours(0, 0, 0, 0);
  await col.updateOne(
    { userId: oid(userId)!, date: day },
    { $set: { mood, anxiety, energy, sleepQuality, sleepHours },
      $setOnInsert: { userId: oid(userId)!, date: day, createdAt: new Date() } },
    { upsert: true },
  );
  return render(chatId, `🙂 Check-in saved ✓\nMood ${mood}/10 · slept ${sleepHours}h. Be gentle with yourself today.`, BACK);
}

async function handleChat(chatId: number, userId: string, key: Buffer, text: string) {
  const crisis = await runCrisisCheck(userId, text, "chat");
  if (crisis.triggered) return showCrisis(chatId);

  const convos = await collections.chatConversations();
  const msgs = await collections.chatMessages();

  // Persist the user's (encrypted) message regardless of the model's fate.
  await render(chatId, `*You:* ${text}\n\n_…thinking…_`, BACK);
  bot.sendChatAction(chatId, "typing").catch(() => {});

  // The whole LLM interaction is wrapped so a bad/missing key degrades to a
  // friendly message instead of crashing. Memory = our own stored history.
  try {
    let convo = await convos.find({ userId: oid(userId)! }).sort({ updatedAt: -1 }).limit(1).next();
    if (!convo) {
      const now = new Date();
      const r = await convos.insertOne({
        userId: oid(userId)!, openAiThreadId: null, title: text.slice(0, 40), createdAt: now, updatedAt: now,
      });
      convo = { _id: r.insertedId, userId: oid(userId)!, openAiThreadId: null, title: text.slice(0, 40), createdAt: now, updatedAt: now };
    }

    const prior = await msgs.find({ conversationId: convo._id! }).sort({ createdAt: 1 }).toArray();
    const history: ChatTurn[] = prior
      .slice(-20)
      .map((m) => ({ role: m.role === "USER" ? "user" : "assistant", content: decrypt(m.contentEnc, key) }));
    history.push({ role: "user", content: text });

    await msgs.insertOne({ conversationId: convo._id!, role: "USER", contentEnc: encrypt(text, key), flaggedCrisis: false, createdAt: new Date() });
    const reply = await chatReply(history);
    await msgs.insertOne({ conversationId: convo._id!, role: "ASSISTANT", contentEnc: encrypt(reply, key), flaggedCrisis: false, createdAt: new Date() });
    await convos.updateOne({ _id: convo._id! }, { $set: { updatedAt: new Date() } });
    await render(chatId, `*You:* ${text}\n\n*Dildi:* ${reply}\n\n_Keep typing to continue, or tap Menu._`, BACK);
  } catch (e: any) {
    const isAuth = e?.status === 401 || e?.code === "invalid_api_key";
    console.error("[bot] llm error", e?.message ?? e);
    await render(
      chatId,
      `*You:* ${text}\n\n` +
        (isAuth
          ? "💬 The AI companion isn't connected yet — a valid `OPENROUTER_API_KEY` is needed for chat. Your message is safe, and everything else (check-in, journal, activity, insights) works."
          : "I had trouble responding just now — your message is safe. Try again in a moment."),
      BACK,
    );
  }
}

async function showInsights(chatId: number, userId: string) {
  const since = new Date(); since.setDate(since.getDate() - 7);
  const moodC = await collections.moodLogs();
  const moods = await moodC.find({ userId: oid(userId)!, date: { $gte: since } }).sort({ date: 1 }).toArray();
  if (!moods.length) {
    return render(chatId, "📊 *Insights*\n\nNo check-ins in the last 7 days yet.", [
      [{ text: "🙂 Do a check-in", callback_data: "nav:mood" }], ...BACK,
    ]);
  }
  const avg = (k: keyof (typeof moods)[number]) =>
    (moods.reduce((t, m) => t + (m[k] as number), 0) / moods.length).toFixed(1);
  return render(
    chatId,
    `📊 *Your week* (${moods.length} check-ins)\n\n` +
      `• Mood avg: *${avg("mood")}*/10\n` +
      `• Anxiety avg: *${avg("anxiety")}*/10\n` +
      `• Energy avg: *${avg("energy")}*/10\n` +
      `• Sleep avg: *${avg("sleepHours")}*h\n\n` +
      `Open the web app for the full AI narrative and charts.`,
    BACK,
  );
}

// Safety net: a single failed handler should never take the bot down.
process.on("unhandledRejection", (reason) => {
  console.error("[bot] unhandledRejection:", (reason as any)?.message ?? reason);
});
process.on("uncaughtException", (err) => {
  console.error("[bot] uncaughtException:", err?.message ?? err);
});
bot.on("polling_error", (err) => console.error("[bot] polling_error:", err?.message ?? err));

process.on("SIGINT", () => { console.log("\nShutting down bot…"); bot.stopPolling(); process.exit(0); });
