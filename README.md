# MindBridge 🌿

A personal AI therapy & wellness companion. Daily mood check-ins, one-tap
activity logging, an encrypted journal, an AI companion with memory, Google
Calendar sync, and a weekly reflection — in a warm, calm, mobile-first UI.

> **Not medical care.** MindBridge is a wellbeing companion, not a clinician.
> It does not diagnose or treat. In crisis, contact local emergency services.

## Tech stack
- **Next.js 14** (App Router) + **Tailwind CSS**
- **MongoDB** (local) via the official `mongodb` driver
- **NextAuth** (credentials) + biometric (WebAuthn) re-auth
- **OpenAI Assistants API** (threads = memory; file_search + code_interpreter)
- **Google Calendar API** (service account)
- **Telegram bot** front-end + crisis escalation (`node-telegram-bot-api`)

## Setup
```bash
cp .env.example .env        # fill in placeholders (or use the generated .env)
npm install                 # Node ≥ 18.17 required (use Node 20)
# Make sure local MongoDB is running:
brew services start mongodb-community@7.0
npm run dev                 # web app → http://localhost:3000
```

Collections and indexes are created automatically on first DB access
(`src/lib/db.ts`) — no migration step.

### Running the Telegram bot
```bash
# 1. Get a token from @BotFather, put it in .env: TELEGRAM_BOT_TOKEN="123:abc"
# 2. Start the bot (long polling, shares the same MongoDB + crypto + crisis logic):
npm run bot         # or: npm run bot:dev  (auto-reload)
```
In Telegram: `/start` → `/login` (email + password — the bot deletes your
password message right after and derives your encryption key in memory only) →
then `/mood`, `/journal`, `/activity`, `/insights`, or just chat normally.
The bot holds your derived key for `BOT_SESSION_TTL_SECONDS` (default 15 min)
of inactivity, then requires `/login` again.

## Security model — read this

MindBridge encrypts therapy notes, journal bodies, chat messages, and activity
notes with **AES-256-GCM at the field level** before they hit the database. The
key is derived from your password with **PBKDF2-HMAC-SHA256** (210k iterations,
unique per-user salt + a server-side pepper). **The key is never stored** — it's
re-derived at login and held only in the encrypted httpOnly session cookie (web)
or in the bot process memory (Telegram) for that session's life. A stolen
database dump is useless without your password — the encrypted fields in
MongoDB are opaque `iv:authTag:ciphertext` blobs.

**Honest boundary — this is *encrypted-at-rest*, not literal zero-knowledge.**
The AI chat and weekly narrative are server-side features that need plaintext to
send to OpenAI. During an authenticated request the running server can therefore
see decrypted content transiently, and that content is sent to OpenAI (training
disabled). True end-to-end zero-knowledge would require moving key derivation and
en/decryption into the browser and dropping all server-side AI. Every spot where
plaintext is handled server-side is commented in `src/lib/crypto.ts` and the API
routes. Choose the trade-off deliberately.

Other safeguards:
- **Crisis detection** (`src/lib/crisis.ts`) scans message/journal text *before*
  encryption/model calls. On a match: account lock, full-screen crisis resources,
  and Telegram notification to the emergency contact. The triggering text is
  never stored — only matched category labels.
- **Biometric re-auth** after inactivity (`InactivityLock.tsx`, WebAuthn).
- **Audit log** of every sensitive access (`src/lib/audit.ts`).
- **Export** (`/api/export`) and **permanent delete** (`/api/delete`, password +
  `DELETE` confirmation, cascading).
- **No AI training**: never opt in; the privacy setting is display-only and
  always off.

## Project layout
```
src/lib/db.ts, models.ts    # MongoDB connection + typed collections (10 models)
src/lib/                     # crypto, auth, openai, google-calendar, telegram,
                             # crisis, crisis-handler, audit, session, guard
src/app/api/                # mood, activities, journal, chat, calendar,
                             # insights, crisis, export, delete, settings, auth
src/app/{,journal,chat,calendar,insights,settings,login}/  # pages
src/components/              # NavBar, MoodCheckIn, ActivityLogger, CrisisLockout,
                             # InactivityLock, Header, Providers
src/bot/                     # Telegram bot: index.ts (handlers) + session.ts
```

## Caveats / next steps
- Crisis keyword matching is a crude safety net — it over- and under-triggers.
  Pair with a real escalation protocol; consider an ML classifier.
- WebAuthn registration flow is simplified to a presence check; wire full
  credential registration for production.
- Add rate limiting, CSRF hardening, and per-field key rotation before launch.
