/**
 * Crisis detection.
 *
 * This is a SAFETY NET, not a diagnostic tool. It errs toward over-triggering.
 * On any match we: lock the account, surface crisis resources immediately, and
 * (if an emergency contact is set) notify them. We never store the triggering
 * text — only the matched category labels — to respect the privacy promise.
 *
 * IMPORTANT: keyword matching is crude and will miss things and produce false
 * positives. It is not a substitute for clinical care. Tune carefully and pair
 * with human escalation paths.
 */

export type CrisisCategory = "self_harm" | "suicide" | "harm_to_others";

interface Pattern {
  category: CrisisCategory;
  // Word-boundary regexes; case-insensitive applied at match time.
  patterns: RegExp[];
}

const RULES: Pattern[] = [
  {
    category: "suicide",
    patterns: [
      /\bkill myself\b/i,
      /\bend (?:my|it all|my life)\b/i,
      /\bsuicid(?:e|al)\b/i,
      /\bdon'?t want to (?:be here|live|wake up)\b/i,
      /\bbetter off (?:dead|without me)\b/i,
      /\bno reason to (?:live|go on)\b/i,
      /\btake my (?:own )?life\b/i,
    ],
  },
  {
    category: "self_harm",
    patterns: [
      /\b(?:cut|cutting|hurt|harm)(?:ing)? myself\b/i,
      /\bself[-\s]?harm\b/i,
      /\bburn(?:ing)? myself\b/i,
      /\bi (?:want|need) to (?:hurt|punish) myself\b/i,
    ],
  },
  {
    category: "harm_to_others",
    patterns: [
      /\bkill (?:him|her|them|you|everyone)\b/i,
      /\bhurt (?:him|her|them|someone)\b/i,
      /\bwant to (?:attack|stab|shoot)\b/i,
    ],
  },
];

export interface CrisisResult {
  triggered: boolean;
  categories: CrisisCategory[];
}

export function detectCrisis(text: string): CrisisResult {
  const categories = new Set<CrisisCategory>();
  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(text))) {
      categories.add(rule.category);
    }
  }
  return { triggered: categories.size > 0, categories: [...categories] };
}

/** Region-agnostic crisis resources shown on lockout. Localize as needed. */
export const CRISIS_RESOURCES = [
  { label: "988 Suicide & Crisis Lifeline (US)", value: "Call or text 988" },
  { label: "Crisis Text Line", value: "Text HOME to 741741 (US/CA), 85258 (UK)" },
  { label: "International Association for Suicide Prevention", value: "https://www.iasp.info/resources/Crisis_Centres/" },
  { label: "Emergency services", value: "Call your local emergency number (911 / 112 / 999)" },
];
