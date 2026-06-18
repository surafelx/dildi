/** Self-help exercises (Tier 0–2). Psychoeducational, safe, general. */
export type ExerciseCategory = "Mindfulness" | "Relaxation" | "CBT";

export interface Exercise {
  id: string;
  title: string;
  category: ExerciseCategory;
  minutes: number;
  icon: string;
  intro: string;
  steps: string[];
  breathing?: boolean; // show the breathing orb
}

export const EXERCISES: Exercise[] = [
  {
    id: "breathing",
    title: "Breathing Exercise",
    category: "Mindfulness",
    minutes: 3,
    icon: "🫧",
    intro: "A few rounds of slow box-breathing to settle your nervous system.",
    steps: [
      "Sit comfortably and let your shoulders drop.",
      "Breathe in through your nose for 4 counts.",
      "Hold gently for 4 counts.",
      "Breathe out slowly for 4 counts, then rest for 2.",
      "Follow the orb below and repeat for a few rounds.",
    ],
    breathing: true,
  },
  {
    id: "grounding",
    title: "Grounding Technique",
    category: "Relaxation",
    minutes: 5,
    icon: "🌿",
    intro: "The 5-4-3-2-1 method brings you back to the present moment.",
    steps: [
      "Name 5 things you can see.",
      "Name 4 things you can feel or touch.",
      "Name 3 things you can hear.",
      "Name 2 things you can smell.",
      "Name 1 thing you can taste.",
      "Notice your feet on the floor. You are here, now.",
    ],
  },
  {
    id: "affirmations",
    title: "Positive Affirmations",
    category: "Mindfulness",
    minutes: 4,
    icon: "💛",
    intro: "Gentle, true-feeling statements to soften harsh self-talk.",
    steps: [
      "Read each line slowly, to yourself or aloud.",
      "“I'm allowed to take this one step at a time.”",
      "“My feelings are valid, and they will pass.”",
      "“I've gotten through hard days before.”",
      "“I'm doing the best I can with what I have.”",
      "Pick the one that lands and carry it with you today.",
    ],
  },
  {
    id: "body-scan",
    title: "Body Scan",
    category: "Relaxation",
    minutes: 7,
    icon: "🧘",
    intro: "Release tension by moving your attention slowly through the body.",
    steps: [
      "Lie down or sit and close your eyes if that's comfortable.",
      "Bring attention to your feet — notice any sensation, then soften.",
      "Move up through your legs, hips, and belly, releasing as you go.",
      "Notice your chest, shoulders, arms, and hands.",
      "Finally your neck, jaw, and face — let them unclench.",
      "Rest for a moment in the whole body, breathing easy.",
    ],
  },
  {
    id: "thought-reframe",
    title: "Thought Reframe",
    category: "CBT",
    minutes: 6,
    icon: "🔍",
    intro: "Catch a hard thought and find a more balanced one (a thought record).",
    steps: [
      "This opens the guided thought record in the Therapy program.",
      "You'll name the situation, the feeling, and the automatic thought.",
      "Then weigh the evidence and write a kinder, balanced thought.",
    ],
  },
  {
    id: "worry-time",
    title: "Worry Time",
    category: "CBT",
    minutes: 5,
    icon: "⏳",
    intro: "Contain rumination by giving worries a scheduled, bounded space.",
    steps: [
      "When a worry shows up, jot it down and set it aside for now.",
      "Choose a fixed 10-minute “worry time” later today.",
      "During that window, review the list — problem-solve what you can.",
      "Anything you can't act on, practice letting rest until tomorrow.",
    ],
  },
];

export const CATEGORIES: ("All" | ExerciseCategory)[] = ["All", "Mindfulness", "Relaxation", "CBT"];
