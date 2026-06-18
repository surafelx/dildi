import { NextResponse } from "next/server";
import { z } from "zod";
import { collections } from "@/lib/models";
import { hashPassword } from "@/lib/auth";
import { newSalt, deriveKey, makeVerifier } from "@/lib/crypto";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(10, "Use at least 10 characters"),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, name, password } = parsed.data;
  const users = await collections.users();

  if (await users.findOne({ email: email.toLowerCase() })) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  // Derive the field-encryption key now so we can store a verifier (not the key).
  const encSalt = newSalt();
  const key = deriveKey(password, encSalt);
  const now = new Date();

  const res = await users.insertOne({
    email: email.toLowerCase(),
    name: name ?? null,
    passwordHash: hashPassword(password),
    encSalt,
    encVerifier: makeVerifier(key),
    biometricEnabled: true,
    inactivityLockSeconds: 300,
    allowAiTraining: false,
    emergencyContactName: null,
    emergencyContactPhone: null,
    emergencyContactTelegram: null,
    crisisLockedUntil: null,
    telegramChatId: null,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id: res.insertedId.toHexString(), email: email.toLowerCase() });
}
