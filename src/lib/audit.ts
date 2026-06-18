import { collections } from "./models";
import { oid } from "./db";

/**
 * Append-only audit logging of every access to sensitive data.
 * `reqHeaders` is optional so this works from both API routes and the bot.
 */
export async function audit(
  userId: string,
  action: string,
  resource: string,
  reqHeaders?: { ip?: string | null; userAgent?: string | null },
) {
  const _id = oid(userId);
  if (!_id) return;
  const logs = await collections.auditLogs();
  await logs.insertOne({
    userId: _id,
    action,
    resource,
    ip: reqHeaders?.ip ?? null,
    userAgent: reqHeaders?.userAgent ?? null,
    createdAt: new Date(),
  });
}
