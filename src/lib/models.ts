import { Collection, ObjectId } from "mongodb";
import { getDb } from "./db";

/**
 * Typed collection accessors + document interfaces. References between
 * documents are stored as ObjectId. Encrypted fields hold the
 * `iv:authTag:ciphertext` string produced by src/lib/crypto.ts.
 */

export type ActivityType = "EXERCISE" | "MEDITATION" | "SOCIAL" | "THERAPY" | "OTHER";
export type CalendarKind = "THERAPY" | "CHECKIN_REMINDER" | "OTHER";
export type ChatRole = "USER" | "ASSISTANT";
export type CrisisStatus = "TRIGGERED" | "CONTACT_NOTIFIED" | "RESOLVED";

export interface UserDoc {
  _id?: ObjectId;
  email: string;
  name: string | null;
  passwordHash: string;
  encSalt: string;
  encVerifier: string;
  biometricEnabled: boolean;
  inactivityLockSeconds: number;
  allowAiTraining: boolean;
  companionPersonality: string; // tone preset id (see lib/llm PERSONALITIES)
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactTelegram: string | null;
  crisisLockedUntil: Date | null;
  // Telegram linkage: chat id of the user's DM with the bot.
  telegramChatId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MoodLogDoc {
  _id?: ObjectId;
  userId: ObjectId;
  date: Date;
  mood: number;
  anxiety: number;
  energy: number;
  sleepQuality: number;
  sleepHours: number;
  createdAt: Date;
}

export interface ActivityDoc {
  _id?: ObjectId;
  userId: ObjectId;
  type: ActivityType;
  note: string | null; // encrypted if present
  occurredAt: Date;
}

export interface JournalEntryDoc {
  _id?: ObjectId;
  userId: ObjectId;
  date: Date;
  titleEnc: string | null;
  bodyEnc: string;
  moodTags: string[];
  linkedMoodId: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarEventDoc {
  _id?: ObjectId;
  userId: ObjectId;
  googleEventId: string | null;
  kind: CalendarKind;
  title: string;
  start: Date;
  end: Date | null;
  location: string | null;
  syncedAt: Date;
}

export interface ChatConversationDoc {
  _id?: ObjectId;
  userId: ObjectId;
  openAiThreadId: string | null;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessageDoc {
  _id?: ObjectId;
  conversationId: ObjectId;
  role: ChatRole;
  contentEnc: string;
  flaggedCrisis: boolean;
  createdAt: Date;
}

export interface CrisisAlertDoc {
  _id?: ObjectId;
  userId: ObjectId;
  source: string;
  status: CrisisStatus;
  contactNotified: boolean;
  matchedCategories: string[];
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface GoalDoc {
  _id?: ObjectId;
  userId: ObjectId;
  title: string;
  description: string | null;
  targetDate: Date | null;
  completed: boolean;
  createdAt: Date;
}

export interface AuditLogDoc {
  _id?: ObjectId;
  userId: ObjectId;
  action: string;
  resource: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

// ── CBT program (Tier 2: guided skills) ─────────────────────
export interface ThoughtRecordDoc {
  _id?: ObjectId;
  userId: ObjectId;
  moduleId: string | null;
  // Encrypted free-text (AES-256-GCM) — sensitive.
  situationEnc: string;
  automaticThoughtEnc: string;
  evidenceForEnc: string | null;
  evidenceAgainstEnc: string | null;
  balancedThoughtEnc: string | null;
  emotionEnc: string | null;
  // Lower-sensitivity numeric/label data — stored plain.
  intensityBefore: number; // 0–100
  intensityAfter: number | null; // 0–100
  distortions: string[]; // distortion ids
  createdAt: Date;
}

export interface CbtProgressDoc {
  _id?: ObjectId;
  userId: ObjectId;
  completedModules: string[]; // module ids
  updatedAt: Date;
}

export const collections = {
  users: async (): Promise<Collection<UserDoc>> => (await getDb()).collection<UserDoc>("users"),
  moodLogs: async (): Promise<Collection<MoodLogDoc>> => (await getDb()).collection<MoodLogDoc>("moodLogs"),
  activities: async (): Promise<Collection<ActivityDoc>> => (await getDb()).collection<ActivityDoc>("activities"),
  journalEntries: async (): Promise<Collection<JournalEntryDoc>> => (await getDb()).collection<JournalEntryDoc>("journalEntries"),
  calendarEvents: async (): Promise<Collection<CalendarEventDoc>> => (await getDb()).collection<CalendarEventDoc>("calendarEvents"),
  chatConversations: async (): Promise<Collection<ChatConversationDoc>> => (await getDb()).collection<ChatConversationDoc>("chatConversations"),
  chatMessages: async (): Promise<Collection<ChatMessageDoc>> => (await getDb()).collection<ChatMessageDoc>("chatMessages"),
  crisisAlerts: async (): Promise<Collection<CrisisAlertDoc>> => (await getDb()).collection<CrisisAlertDoc>("crisisAlerts"),
  goals: async (): Promise<Collection<GoalDoc>> => (await getDb()).collection<GoalDoc>("goals"),
  auditLogs: async (): Promise<Collection<AuditLogDoc>> => (await getDb()).collection<AuditLogDoc>("auditLogs"),
  thoughtRecords: async (): Promise<Collection<ThoughtRecordDoc>> => (await getDb()).collection<ThoughtRecordDoc>("thoughtRecords"),
  cbtProgress: async (): Promise<Collection<CbtProgressDoc>> => (await getDb()).collection<CbtProgressDoc>("cbtProgress"),
};

/** Serialize a doc's _id (and known ObjectId refs) to strings for JSON. */
export function toId(id: ObjectId | undefined | null): string {
  return id ? id.toHexString() : "";
}
