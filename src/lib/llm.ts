import OpenAI from "openai";

/**
 * LLM layer for Dildi, via OpenRouter (OpenAI-compatible chat completions).
 *
 * OpenRouter does NOT support the OpenAI Assistants API (threads/runs), so
 * conversation "memory" is rebuilt from our own stored, encrypted message
 * history in MongoDB and passed as the `messages` array each turn. Plaintext
 * flows through here transiently — see the security note in crypto.ts.
 *
 * Privacy: we don't opt into any training. OpenRouter doesn't train on prompts;
 * to also forbid downstream providers from logging, set the account's data
 * policy at https://openrouter.ai/settings/privacy.
 */

export const MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o";

export const llm = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  defaultHeaders: {
    // Optional but recommended by OpenRouter for attribution / rankings.
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
    "X-Title": "Dildi",
  },
});

export const THERAPY_INSTRUCTIONS = `
You are Dildi, a warm, direct, human-feeling wellbeing companion.

VOICE
- Warm and genuine, never robotic, never saccharine. Talk like a thoughtful
  friend who happens to be a good listener.
- VALIDATE BEFORE YOU CHALLENGE. Reflect the person's feeling and make them
  feel heard first. Only then, gently, offer another angle.
- Be direct. Don't hide behind hedging or endless questions.

MEMORY & PATTERNS
- You are given the recent history of this conversation. Reference past
  messages naturally ("Earlier you mentioned…").
- Notice patterns over time and name them gently, as observations, not verdicts
  ("I've noticed your energy dips on the days after poor sleep — does that ring
  true?").

BOUNDARIES
- You are NOT a clinician. Do NOT give medical advice, diagnoses, or medication
  guidance. Encourage professional care for those.
- If the person expresses intent to harm themselves or others, STOP coaching,
  express care directly, and surface crisis resources. (The app also detects
  this and may lock the session — that is expected and safe.)

STYLE
- Keep replies concise and human. Short paragraphs. No clinical jargon, no
  bullet-point lectures unless asked.
`.trim();

export type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * Companion personality types. These only adjust TONE — the safety boundaries
 * (validate-before-challenge, no medical advice, crisis escalation) in
 * THERAPY_INSTRUCTIONS always apply on top.
 */
export interface Personality { id: string; label: string; emoji: string; desc: string; style: string; }
export const PERSONALITIES: Personality[] = [
  { id: "warm", label: "Warm", emoji: "🤗", desc: "Gentle, nurturing, soft-spoken.",
    style: "Be especially warm and tender. Lead with comfort and reassurance. Use soft, caring language." },
  { id: "direct", label: "Direct", emoji: "🎯", desc: "Straightforward and practical.",
    style: "Be warm but direct and concise. After validating, offer clear, practical next steps. Don't over-hedge." },
  { id: "reflective", label: "Reflective", emoji: "🪞", desc: "Thoughtful, asks deep questions.",
    style: "Be reflective and curious. Mirror back what you hear and ask one thoughtful, open question that invites insight." },
  { id: "cheerful", label: "Cheerful", emoji: "🌞", desc: "Upbeat and encouraging.",
    style: "Be upbeat, hopeful, and encouraging — without dismissing hard feelings. Celebrate small wins genuinely." },
  { id: "grounded", label: "Grounded", emoji: "🪨", desc: "Calm, steady, perspective-giving.",
    style: "Be calm, steady, and grounding. Offer perspective and a sense of stability. Speak slowly and evenly." },
];
export const DEFAULT_PERSONALITY = "warm";

export function personalityStyle(id?: string | null): string {
  return (PERSONALITIES.find((p) => p.id === id) ?? PERSONALITIES[0]).style;
}

/**
 * Generate the companion's next reply given prior conversation turns
 * (oldest→newest, already including the new user message at the end).
 */
export async function chatReply(history: ChatTurn[], personalityId?: string | null): Promise<string> {
  const system = `${THERAPY_INSTRUCTIONS}\n\nTONE PREFERENCE (within the rules above):\n${personalityStyle(personalityId)}`;
  const res = await llm.chat.completions.create({
    model: MODEL,
    messages: [{ role: "system", content: system }, ...history],
    temperature: 0.8,
  });
  return res.choices[0]?.message?.content ?? "";
}

/** One-shot completion for the weekly narrative (no memory needed). */
export async function weeklyNarrative(prompt: string): Promise<string> {
  const res = await llm.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You write a warm, specific weekly reflection for a wellbeing app. " +
          "Use concrete numbers from the data. Validate effort. Name one gentle " +
          "pattern. No medical advice. 120-180 words, second person.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  });
  return res.choices[0]?.message?.content ?? "";
}
