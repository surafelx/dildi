/**
 * "Your Bridge" — Dildi's gentle progress system.
 *
 * Every supportive action the user already takes earns a little progress, which
 * accumulates into levels ("% across the bridge"), a streak, and milestones.
 * It's encouragement, not pressure: never punishing, never comparing to others.
 * Computed deterministically from existing data — no separate storage.
 */

export interface BridgeStats {
  moods: number;
  journals: number;
  activities: number;
  thoughtRecords: number;
  modulesCompleted: number;
  checkinDates: string[]; // ISO dates of mood check-ins
  journalDates: string[]; // ISO dates of journal entries
}

export const POINTS = {
  mood: 10,
  journal: 15,
  activity: 5,
  thoughtRecord: 20,
  module: 25,
} as const;

// Cumulative point thresholds. Index 0 = Level 1.
export const LEVELS = [
  { name: "First Step", min: 0 },
  { name: "Settling In", min: 40 },
  { name: "Finding Footing", min: 90 },
  { name: "Building Rhythm", min: 160 },
  { name: "Steady Ground", min: 250 },
  { name: "Gaining Momentum", min: 360 },
  { name: "Steady Builder", min: 500 },
  { name: "Strong Footing", min: 680 },
  { name: "Bridge Keeper", min: 900 },
  { name: "Horizon Walker", min: 1200 },
];

export interface Milestone {
  id: string;
  title: string;
  note: string;
  icon: string;
  earned: boolean;
}

function distinctDays(dates: string[]): number {
  return new Set(dates.map((d) => new Date(d).toDateString())).size;
}

/** Consecutive-day streak of check-ins ending today or yesterday. */
function computeStreak(dates: string[]): number {
  const days = new Set(dates.map((d) => new Date(d).toDateString()));
  if (days.size === 0) return 0;
  let streak = 0;
  const cursor = new Date();
  // Allow the streak to count if they haven't checked in *yet* today.
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface BridgeResult {
  points: number;
  level: number; // 1-based
  levelName: string;
  nextLevelName: string | null;
  progressPct: number; // toward next level (0–100)
  pointsIntoLevel: number;
  pointsForNext: number | null;
  streak: number;
  totals: { moods: number; journals: number; activities: number; thoughtRecords: number; modulesCompleted: number };
  milestones: Milestone[];
}

export function computeBridge(s: BridgeStats): BridgeResult {
  const points =
    s.moods * POINTS.mood +
    s.journals * POINTS.journal +
    s.activities * POINTS.activity +
    s.thoughtRecords * POINTS.thoughtRecord +
    s.modulesCompleted * POINTS.module;

  // Resolve level from thresholds.
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (points >= LEVELS[i].min) idx = i;
  const level = idx + 1;
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;

  const pointsIntoLevel = points - cur.min;
  const pointsForNext = next ? next.min - cur.min : null;
  const progressPct = next ? Math.min(100, Math.round((pointsIntoLevel / (next.min - cur.min)) * 100)) : 100;

  const streak = computeStreak(s.checkinDates);
  const journalDistinct = distinctDays(s.journalDates);

  const milestones: Milestone[] = [
    { id: "first_checkin", icon: "🌱", title: "First Check-in", note: "Awareness creates change.", earned: s.moods >= 1 },
    { id: "first_words", icon: "✍️", title: "First Words", note: "You opened the page.", earned: s.journals >= 1 },
    { id: "streak_7", icon: "🔥", title: "Steady Week", note: "Seven days, showing up.", earned: streak >= 7 },
    { id: "journal_7", icon: "📓", title: "7 Days Journaling", note: "Keep showing up for yourself.", earned: journalDistinct >= 7 },
    { id: "in_motion", icon: "🏃", title: "In Motion", note: "Five activities logged.", earned: s.activities >= 5 },
    { id: "thought_detective", icon: "🔍", title: "Thought Detective", note: "You questioned a hard thought.", earned: s.thoughtRecords >= 1 },
    { id: "skill_builder", icon: "🧭", title: "Skill Builder", note: "You've taken a positive step.", earned: s.modulesCompleted >= 1 },
    { id: "course_complete", icon: "🎓", title: "Course Complete", note: "You finished the CBT program.", earned: s.modulesCompleted >= 6 },
    { id: "halfway", icon: "🌉", title: "Halfway Across", note: "You've come a long way.", earned: level >= 5 },
  ];

  return {
    points, level, levelName: cur.name, nextLevelName: next?.name ?? null,
    progressPct, pointsIntoLevel, pointsForNext, streak,
    totals: {
      moods: s.moods, journals: s.journals, activities: s.activities,
      thoughtRecords: s.thoughtRecords, modulesCompleted: s.modulesCompleted,
    },
    milestones,
  };
}
