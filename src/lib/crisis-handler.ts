import { collections } from "./models";
import { oid } from "./db";
import { detectCrisis } from "./crisis";
import { sendTelegram, crisisMessage } from "./telegram";
import { audit } from "./audit";

/**
 * Shared crisis pipeline used by chat / journal / mood-note endpoints AND the
 * Telegram bot. Detects, records an alert (without storing the text), locks the
 * account, and notifies the emergency contact if one is configured.
 */
export async function runCrisisCheck(
  userId: string,
  text: string,
  source: "chat" | "journal" | "mood-note",
) {
  const result = detectCrisis(text);
  if (!result.triggered) return { triggered: false as const };

  const _id = oid(userId);
  if (!_id) return { triggered: false as const };

  const users = await collections.users();
  const alerts = await collections.crisisAlerts();

  const user = await users.findOne({ _id });
  const lockUntil = new Date(Date.now() + 60 * 60 * 1000); // 1h lock

  const alertRes = await alerts.insertOne({
    userId: _id,
    source,
    matchedCategories: result.categories,
    status: "TRIGGERED",
    contactNotified: false,
    createdAt: new Date(),
    resolvedAt: null,
  });

  await users.updateOne({ _id }, { $set: { crisisLockedUntil: lockUntil } });
  await audit(userId, "crisis.triggered", `alert:${alertRes.insertedId.toHexString()}`);

  // Notify emergency contact via Telegram, if set.
  let notified = false;
  if (user?.emergencyContactTelegram) {
    notified = await sendTelegram(user.emergencyContactTelegram, crisisMessage(user.name));
    if (notified) {
      await alerts.updateOne(
        { _id: alertRes.insertedId },
        { $set: { status: "CONTACT_NOTIFIED", contactNotified: true } },
      );
      await audit(userId, "crisis.contact_notified", `alert:${alertRes.insertedId.toHexString()}`);
    }
  }

  return {
    triggered: true as const,
    categories: result.categories,
    lockedUntil: lockUntil,
    contactNotified: notified,
  };
}
