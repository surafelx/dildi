/**
 * Dildi's self-guided CBT program (Tier 2: guided skills).
 *
 * This is PSYCHOEDUCATION + structured self-help exercises, not treatment.
 * Content is general, evidence-based CBT, written to be supportive and safe.
 * It should be reviewed by a licensed clinician before launch. Nothing here
 * diagnoses, and every module points users to human help when needed.
 */

export type PracticeType =
  | "thought_record"
  | "reflection"
  | "activation"
  | "breathing";

export interface CbtModule {
  id: string;
  week: number;
  title: string;
  subtitle: string;
  minutes: number;
  /** Short psychoeducation paragraphs (the "learn" part). */
  learn: string[];
  practiceType: PracticeType;
  practicePrompt: string;
}

export const CBT_PROGRAM: CbtModule[] = [
  {
    id: "cbt-1-cycle",
    week: 1,
    title: "The thought–feeling–behavior cycle",
    subtitle: "How CBT works, and why it helps",
    minutes: 6,
    learn: [
      "Cognitive Behavioral Therapy (CBT) is built on a simple idea: our thoughts, feelings, and actions are linked. The same situation can feel very different depending on the thought we attach to it.",
      "Imagine a friend doesn't reply to your message. The thought \"they're ignoring me\" leads to hurt and withdrawal. The thought \"they're probably busy\" leads to calm and patience. Same event — different thought, different feeling, different behavior.",
      "CBT doesn't ask you to \"think positive.\" It asks you to look at your thoughts honestly, like a curious scientist, and check whether they're accurate and helpful. Over time, that loosens the grip of painful thoughts.",
      "This program is a gentle, self-guided introduction. Go at your own pace. It isn't therapy or a substitute for professional care — if things feel heavy, reaching out to a person is a strong, healthy step.",
    ],
    practiceType: "reflection",
    practicePrompt:
      "Think of a recent moment your mood shifted. What was the situation, what went through your mind, and how did you then feel and act?",
  },
  {
    id: "cbt-2-automatic-thoughts",
    week: 2,
    title: "Catching automatic thoughts",
    subtitle: "Noticing the quiet narrator",
    minutes: 7,
    learn: [
      "Automatic thoughts are the quick, almost reflexive things we tell ourselves — so fast we often don't notice them, only the feeling they leave behind.",
      "They tend to feel like facts. But they're interpretations, and interpretations can be checked. The first skill is simply noticing them: \"What just went through my mind?\"",
      "A useful cue is a sudden shift in feeling. When your mood dips, pause and ask: what was I just thinking? That thought is the one worth writing down.",
    ],
    practiceType: "thought_record",
    practicePrompt:
      "Let's catch one automatic thought together with a guided thought record.",
  },
  {
    id: "cbt-3-thinking-traps",
    week: 3,
    title: "Spotting thinking traps",
    subtitle: "Common patterns that distort reality",
    minutes: 8,
    learn: [
      "Our minds take shortcuts, and under stress those shortcuts skew negative. These are \"cognitive distortions\" — thinking traps. Naming them takes away some of their power.",
      "You'll recognize a few in yourself: all-or-nothing thinking, catastrophizing, mind-reading, emotional reasoning (\"I feel it, so it must be true\"), and harsh \"should\" statements are some of the most common.",
      "The goal isn't to judge yourself for having them — everyone does. It's to spot them in the moment, so a thought like \"I always mess everything up\" can be met with \"that's all-or-nothing thinking.\"",
    ],
    practiceType: "thought_record",
    practicePrompt:
      "Catch a thought and, this time, see which thinking traps might be in it.",
  },
  {
    id: "cbt-4-evidence",
    week: 4,
    title: "Examining the evidence",
    subtitle: "Building a balanced thought",
    minutes: 9,
    learn: [
      "Once you've caught a hot thought, you can put it on trial — gently. What's the evidence it's true? What's the evidence it isn't? What would you say to a friend who had this thought?",
      "The aim isn't a forced silver lining. It's a balanced thought: one that accounts for all the evidence and tends to feel more accurate and a little kinder.",
      "Notice your emotion's intensity before and after. Often it doesn't vanish — but it softens, and that bit of space is where choice returns.",
    ],
    practiceType: "thought_record",
    practicePrompt:
      "Work a full thought record: catch the thought, weigh the evidence, and write a balanced alternative.",
  },
  {
    id: "cbt-5-activation",
    week: 5,
    title: "Doing what matters",
    subtitle: "Behavioral activation",
    minutes: 7,
    learn: [
      "When mood is low, we naturally do less — and doing less tends to lower mood further. Behavioral activation gently reverses that loop.",
      "The trick is to act first, motivation often follows. Small, value-aligned actions — a short walk, a message to a friend, ten minutes on something that matters — can lift mood more reliably than waiting to \"feel like it.\"",
      "In Dildi, your activity log and lanterns are exactly this. Pick one small thing today, do it, and notice what happens to how you feel.",
    ],
    practiceType: "activation",
    practicePrompt:
      "Choose one small, meaningful action for today and log it. Notice your mood before and after.",
  },
  {
    id: "cbt-6-staying-well",
    week: 6,
    title: "Putting it together & staying well",
    subtitle: "Your personal toolkit",
    minutes: 6,
    learn: [
      "You've learned to notice thoughts, spot traps, weigh evidence, and act on what matters. Together that's a portable toolkit you can use anywhere.",
      "Setbacks are normal and not failures — they're practice. The skill is recognizing early warning signs (sleep slipping, withdrawing, harsher self-talk) and returning to your tools sooner.",
      "Keep what helped, leave what didn't. And remember the most important tool of all: reaching out. Dildi is a companion, not a replacement for people or professional care.",
    ],
    practiceType: "breathing",
    practicePrompt:
      "Take a few rounds of breathing, then note the one or two tools you want to keep close.",
  },
];

export interface Distortion {
  id: string;
  label: string;
  desc: string;
}

export const DISTORTIONS: Distortion[] = [
  { id: "all_or_nothing", label: "All-or-nothing", desc: "Seeing things in black-and-white extremes." },
  { id: "overgeneralizing", label: "Overgeneralizing", desc: "One event becomes a never-ending pattern (\"always\", \"never\")." },
  { id: "mental_filter", label: "Mental filter", desc: "Focusing only on the negatives, filtering out the rest." },
  { id: "discounting_positive", label: "Discounting the positive", desc: "Dismissing good things as not counting." },
  { id: "mind_reading", label: "Mind-reading", desc: "Assuming you know what others are thinking." },
  { id: "fortune_telling", label: "Fortune-telling", desc: "Predicting the future will go badly." },
  { id: "catastrophizing", label: "Catastrophizing", desc: "Blowing things up into the worst case." },
  { id: "emotional_reasoning", label: "Emotional reasoning", desc: "\"I feel it, so it must be true.\"" },
  { id: "should_statements", label: "Should statements", desc: "Rigid rules about how you/others must be." },
  { id: "labeling", label: "Labeling", desc: "Turning a slip into a global label (\"I'm a failure\")." },
  { id: "personalizing", label: "Personalizing", desc: "Taking the blame for things outside your control." },
];
