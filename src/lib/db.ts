import { MongoClient, Db, ObjectId } from "mongodb";

/**
 * Local MongoDB connection (shared by the Next.js app and the Telegram bot).
 * Cached across hot-reloads in dev.
 */
const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB ?? "mindbridge";

const globalForMongo = globalThis as unknown as {
  _mongoClient?: MongoClient;
  _mongoDb?: Db;
  _mongoIndexed?: boolean;
};

let client: MongoClient;
if (globalForMongo._mongoClient) {
  client = globalForMongo._mongoClient;
} else {
  client = new MongoClient(uri);
  globalForMongo._mongoClient = client;
}

let connecting: Promise<Db> | null = null;

export async function getDb(): Promise<Db> {
  if (globalForMongo._mongoDb) return globalForMongo._mongoDb;
  if (!connecting) {
    connecting = client.connect().then(async () => {
      const db = client.db(dbName);
      globalForMongo._mongoDb = db;
      if (!globalForMongo._mongoIndexed) {
        await ensureIndexes(db);
        globalForMongo._mongoIndexed = true;
      }
      return db;
    });
  }
  return connecting;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("moodLogs").createIndex({ userId: 1, date: 1 }, { unique: true }),
    db.collection("activities").createIndex({ userId: 1, occurredAt: -1 }),
    db.collection("journalEntries").createIndex({ userId: 1, date: -1 }),
    db.collection("calendarEvents").createIndex({ googleEventId: 1 }, { unique: true, sparse: true }),
    db.collection("calendarEvents").createIndex({ userId: 1, start: 1 }),
    db.collection("chatConversations").createIndex({ userId: 1, updatedAt: -1 }),
    db.collection("chatMessages").createIndex({ conversationId: 1, createdAt: 1 }),
    db.collection("crisisAlerts").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("goals").createIndex({ userId: 1 }),
    db.collection("auditLogs").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("thoughtRecords").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("cbtProgress").createIndex({ userId: 1 }, { unique: true }),
  ]);
}

/** Safe ObjectId parse — returns null instead of throwing on bad input. */
export function oid(id: string | ObjectId): ObjectId | null {
  if (id instanceof ObjectId) return id;
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

export { ObjectId };
