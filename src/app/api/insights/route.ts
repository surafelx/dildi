import { NextResponse } from "next/server";
import { collections } from "@/lib/models";
import { oid } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { decrypt } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { weeklyNarrative } from "@/lib/llm";

/**
 * GET /api/insights -> last-7-day mood/activity aggregates + an AI narrative.
 * The narrative call transiently decrypts journal snippets server-side (see
 * the security note in crypto.ts). Numeric mood/activity data is not sensitive.
 */
export async function GET(req: Request) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = oid(s.userId)!;
  const range = new URL(req.url).searchParams.get("range") ?? "week";
  const days = range === "year" ? 365 : range === "month" ? 30 : 7;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [moodCol, actCol, jrnCol] = await Promise.all([
    collections.moodLogs(),
    collections.activities(),
    collections.journalEntries(),
  ]);
  const [moods, activities, journals] = await Promise.all([
    moodCol.find({ userId, date: { $gte: since } }).sort({ date: 1 }).toArray(),
    actCol.find({ userId, occurredAt: { $gte: since } }).toArray(),
    jrnCol.find({ userId, date: { $gte: since } }).sort({ date: 1 }).toArray(),
  ]);

  const activityCounts: Record<string, number> = {};
  for (const a of activities) activityCounts[a.type] = (activityCounts[a.type] ?? 0) + 1;

  const avg = (k: "mood" | "anxiety" | "energy" | "sleepQuality" | "sleepHours") =>
    moods.length ? +(moods.reduce((t, m) => t + (m as any)[k], 0) / moods.length).toFixed(1) : null;
  const bestMoodDay = moods.reduce(
    (best, m) => (!best || m.mood > best.mood ? m : best),
    null as null | (typeof moods)[number],
  );

  const summary = {
    averages: {
      mood: avg("mood"),
      anxiety: avg("anxiety"),
      energy: avg("energy"),
      sleepQuality: avg("sleepQuality"),
      sleepHours: avg("sleepHours"),
    },
    activityCounts,
    bestMoodDay: bestMoodDay ? { date: bestMoodDay.date, mood: bestMoodDay.mood } : null,
    checkInCount: moods.length,
    journalCount: journals.length,
  };

  // Top emotions — aggregate the (non-sensitive) mood tags on journal entries.
  const tagCounts: Record<string, number> = {};
  for (const j of journals) for (const t of j.moodTags ?? []) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  const tagTotal = Object.values(tagCounts).reduce((a, b) => a + b, 0);
  const topEmotions = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, n]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      pct: Math.round((n / tagTotal) * 100),
    }));

  await audit(s.userId, "insights.generate", `journals:${journals.length}`);
  const journalSnippets = journals
    .map((j) => decrypt(j.bodyEnc, s.key).slice(0, 300))
    .join("\n---\n");

  const prompt = [
    `Mood (1-10) over 7 days: ${moods.map((m) => m.mood).join(", ") || "no data"}.`,
    `Averages: ${JSON.stringify(summary.averages)}.`,
    `Activities this week: ${JSON.stringify(activityCounts)}.`,
    `Best mood day: ${bestMoodDay ? bestMoodDay.date.toISOString().slice(0, 10) : "n/a"}.`,
    journalSnippets ? `Journal excerpts:\n${journalSnippets}` : "No journal entries.",
  ].join("\n");

  let narrative = "";
  try {
    narrative = await weeklyNarrative(prompt);
  } catch (e) {
    console.error("[insights] narrative failed", e);
    narrative = "Your weekly reflection couldn't be generated right now — your data is safe and you can try again shortly.";
  }

  return NextResponse.json({ summary, moods, narrative, topEmotions, range });
}
