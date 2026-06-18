import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { collections } from "./models";
import { deriveKey, checkVerifier, keyToString } from "./crypto";
import { scryptSync, timingSafeEqual, randomBytes } from "crypto";

/** Password hashing for LOGIN verification (separate from the enc key). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/**
 * The derived AES key rides inside the encrypted (httpOnly) NextAuth JWT.
 * It is NEVER written to the database. On logout/expiry it's gone, and the
 * user must re-enter their password to re-derive it.
 */
declare module "next-auth" {
  interface Session {
    user: { id: string; email: string; name?: string | null };
    encKey: string; // base64 AES-256 key
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8h
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const users = await collections.users();
        const user = await users.findOne({ email: credentials.email.toLowerCase() });
        if (!user) return null;
        if (!verifyPassword(credentials.password, user.passwordHash)) return null;

        // Derive the field-encryption key and confirm it against the verifier.
        const key = deriveKey(credentials.password, user.encSalt);
        if (!checkVerifier(user.encVerifier, key)) return null;

        return {
          id: user._id!.toHexString(),
          email: user.email,
          name: user.name,
          encKey: keyToString(key),
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as any).id;
        token.encKey = (user as any).encKey;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.uid as string,
        email: session.user?.email ?? "",
        name: session.user?.name,
      };
      session.encKey = token.encKey as string;
      return session;
    },
  },
};
