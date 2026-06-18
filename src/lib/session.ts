import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { keyFromString } from "./crypto";

/**
 * Resolve the authenticated user + their in-session encryption key for an
 * API route. Returns null if unauthenticated.
 */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.encKey) return null;
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    key: keyFromString(session.encKey),
  };
}
