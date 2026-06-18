"use client";

/**
 * Dildi's signature view: a stylized suspension bridge over water that reacts
 * to how you're doing. (dildiy = "bridge" in Amharic.)
 *
 *  • Sky + water color come from your MOOD and the time of day.
 *  • Cloud cover + wave turbulence rise with your ANXIETY.
 *  • The sun/moon glow grows with your ENERGY.
 *  • Each activity you log today lights a LANTERN on the railing.
 */

type Props = {
  mood: number | null;       // 1–10
  anxiety: number | null;    // 1–10
  energy: number | null;     // 1–10
  lanternsLit: number;       // activities logged today
  hour?: number;             // 0–23, defaults to now
};

// ── tiny color helpers ─────────────────────────────────────────
function hexToRgb(h: string) {
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r: number, g: number, b: number) {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mix(h1: string, h2: string, t: number) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}

type Bucket = "dawn" | "day" | "dusk" | "night";
function bucketOf(hour: number): Bucket {
  if (hour < 6 || hour >= 20) return "night";
  if (hour < 10) return "dawn";
  if (hour < 17) return "day";
  return "dusk";
}

const SKY: Record<Bucket, { top: string; bot: string; body: string; deck: string }> = {
  dawn:  { top: "#9fc2e0", bot: "#ffd9b0", body: "#ffd27a", deck: "#5b4a40" },
  day:   { top: "#bfe0f0", bot: "#eaf6f5", body: "#ffe49b", deck: "#5b4a40" },
  dusk:  { top: "#f3a978", bot: "#d98b6a", body: "#ffcaa0", deck: "#43352e" },
  night: { top: "#1f2b3c", bot: "#3a4a5e", body: "#e8eef7", deck: "#2a2420" },
};

export default function BridgeScape({ mood, anxiety, energy, lanternsLit, hour }: Props) {
  const h = hour ?? new Date().getHours();
  const bucket = bucketOf(h);
  const base = SKY[bucket];

  const moodN = (mood ?? 5);
  const anxN = (anxiety ?? 5);
  const enN = (energy ?? 5);
  const moodT = (moodN - 1) / 9;   // 0 (low) – 1 (high)
  const anxT = (anxN - 1) / 9;
  const enT = (enN - 1) / 9;

  // Low mood desaturates the sky toward a muted grey; high mood keeps it vivid.
  const GREY = "#aeb4b3";
  const desat = (1 - moodT) * 0.45;
  const skyTop = mix(base.top, GREY, desat);
  const skyBot = mix(base.bot, GREY, desat);

  // Water mirrors the sky, pulled toward Dildi's forest green.
  const waterTop = mix(skyBot, "#4A7C6F", 0.45);
  const waterBot = mix("#2f5a50", "#1d3b34", 1 - moodT * 0.6);

  // Anxiety → more clouds + bigger waves. Energy → bigger celestial glow.
  const cloudCount = Math.round(anxT * 3);          // 0–3
  const waveAmp = 2 + anxT * 5;                       // 2–7 px
  const glowR = 14 + enT * 16;                        // 14–30 px
  const night = bucket === "night";

  // Suspension-cable middle span: quadratic P0(110,64) C(200,124) P1(290,64)
  const cableY = (t: number) => (1 - t) ** 2 * 64 + 2 * (1 - t) * t * 124 + t ** 2 * 64;
  const cableX = (t: number) => (1 - t) ** 2 * 110 + 2 * (1 - t) * t * 200 + t ** 2 * 290;
  const suspenders = [0.12, 0.24, 0.36, 0.5, 0.64, 0.76, 0.88].map((t) => ({ x: cableX(t), y: cableY(t) }));

  // Lanterns along the deck.
  const lanternXs = [40, 75, 110, 145, 180, 215, 250, 285, 320, 355];
  const lit = Math.max(0, Math.min(lanternXs.length, lanternsLit));

  const caption =
    mood == null
      ? "Check in to set today's skies."
      : moodN >= 7
      ? anxN >= 7 ? "Bright skies, busy currents." : "Clear skies over calm water."
      : moodN >= 4
      ? "Gentle weather. One step at a time."
      : "Heavier skies today — that's okay. You're still crossing.";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/60 shadow-soft">
      <svg viewBox="0 0 400 240" className="block w-full" role="img" aria-label="Your bridge today">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={skyTop} />
            <stop offset="100%" stopColor={skyBot} />
          </linearGradient>
          <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={waterTop} />
            <stop offset="100%" stopColor={waterBot} />
          </linearGradient>
          <radialGradient id="bodyGlow">
            <stop offset="0%" stopColor={base.body} stopOpacity="0.95" />
            <stop offset="60%" stopColor={base.body} stopOpacity="0.35" />
            <stop offset="100%" stopColor={base.body} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lanternGlow">
            <stop offset="0%" stopColor="#ffd988" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ffd988" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* sky */}
        <rect x="0" y="0" width="400" height="150" fill="url(#sky)" />

        {/* stars at night */}
        {night && [...Array(18)].map((_, i) => (
          <circle key={i} className="twinkle" cx={(i * 53) % 400} cy={(i * 29) % 110}
            r={i % 3 === 0 ? 1.4 : 0.9} fill="#ffffff"
            style={{ animationDelay: `${(i % 5) * 0.6}s` }} />
        ))}

        {/* celestial body + glow */}
        <g>
          <circle cx="300" cy="52" r={glowR + 12} fill="url(#bodyGlow)" />
          <circle cx="300" cy="52" r={night ? 13 : 16} fill={base.body} />
          {night && <circle cx="295" cy="48" r="11" fill={skyTop} opacity="0.85" />}
        </g>

        {/* drifting clouds (more when anxious) */}
        {[...Array(cloudCount)].map((_, i) => (
          <g key={i} className="cloud-drift" opacity={0.55 + anxT * 0.3}
            style={{ animationDuration: `${38 - i * 6}s`, animationDelay: `${i * -7}s` }}>
            <ellipse cx={60 + i * 40} cy={30 + i * 16} rx="26" ry="10" fill="#ffffff" />
            <ellipse cx={82 + i * 40} cy={34 + i * 16} rx="20" ry="9" fill="#ffffff" />
          </g>
        ))}

        {/* water */}
        <rect x="0" y="150" width="400" height="90" fill="url(#water)" />
        {/* reflection of the body */}
        <ellipse className="water-shimmer" cx="300" cy="168" rx="14" ry="4"
          fill={base.body} opacity="0.5" />
        {/* waves (amplitude rises with anxiety) */}
        {[176, 196, 216].map((y, i) => (
          <path key={y} className="water-shimmer"
            d={`M0 ${y} q 50 -${waveAmp} 100 0 t 100 0 t 100 0 t 100 0`}
            stroke="#ffffff" strokeOpacity={0.22 - i * 0.05} strokeWidth="1.5" fill="none"
            style={{ animationDelay: `${i * 0.7}s` }} />
        ))}

        {/* little boat */}
        <g className="boat-sway">
          <path d="M150 158 l24 0 l-4 7 l-16 0 z" fill={base.deck} />
          <rect x="161" y="146" width="1.5" height="12" fill={base.deck} />
          <path d="M162.5 147 l9 8 l-9 0 z" fill="#ffffff" opacity="0.85" />
        </g>

        {/* ── the bridge ── */}
        {/* towers */}
        <rect x="107" y="64" width="6" height="86" fill={base.deck} />
        <rect x="287" y="64" width="6" height="86" fill={base.deck} />
        {/* side cables */}
        <line x1="14" y1="150" x2="110" y2="64" stroke={base.deck} strokeWidth="2" />
        <line x1="290" y1="64" x2="386" y2="150" stroke={base.deck} strokeWidth="2" />
        {/* main span cable */}
        <path d="M110 64 Q 200 124 290 64" stroke={base.deck} strokeWidth="2" fill="none" />
        {/* suspenders */}
        {suspenders.map((p, i) => (
          <line key={i} x1={p.x} y1={p.y} x2={p.x} y2="148" stroke={base.deck} strokeWidth="1" opacity="0.7" />
        ))}
        {/* deck */}
        <rect x="6" y="148" width="388" height="5" rx="2" fill={base.deck} />

        {/* lanterns */}
        {lanternXs.map((x, i) => {
          const on = i < lit;
          return (
            <g key={x}>
              {on && <circle className="lantern-glow" cx={x} cy="142" r="9" fill="url(#lanternGlow)"
                style={{ animationDelay: `${(i % 4) * 0.4}s` }} />}
              <line x1={x} y1="148" x2={x} y2="139" stroke={base.deck} strokeWidth="1" />
              <circle cx={x} cy="138" r="2.6" fill={on ? "#ffcf6b" : "#9a948c"}
                stroke={on ? "#e8a13f" : "#7d776f"} strokeWidth="0.6" />
            </g>
          );
        })}
      </svg>

      {/* caption */}
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
        <span className="rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
          {caption}
        </span>
        <span className="rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
          🏮 {lit}/{lanternXs.length}
        </span>
      </div>
    </div>
  );
}
