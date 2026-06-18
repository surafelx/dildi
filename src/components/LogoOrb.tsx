/**
 * The Dildi mark inside a gently pulsing sunset orb — the landing centerpiece.
 * A bridge arc glyph sits centered in a glowing glass orb.
 */
export default function LogoOrb() {
  return (
    <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
      {/* soft pulsing ring */}
      <span className="breathe-ring absolute inset-0 rounded-full bg-[#F2A65A]/25" />
      {/* glowing sunset core */}
      <span
        className="float-slow absolute inset-3 rounded-full blur-2xl"
        style={{ background: "radial-gradient(circle at 50% 35%, #F4B860, #E27D6E 55%, #9B7BC0 100%)" }}
      />
      {/* glass orb with the bridge mark */}
      <span className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/50 bg-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6),0_10px_30px_-10px_rgba(0,0,0,0.4)] backdrop-blur-md">
        <svg viewBox="0 0 48 28" className="w-12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          {/* suspension-bridge arc */}
          <path d="M4 22 Q24 2 44 22" />
          <line x1="4" y1="22" x2="4" y2="14" />
          <line x1="44" y1="22" x2="44" y2="14" />
          <line x1="14" y1="13.5" x2="14" y2="22" />
          <line x1="24" y1="9" x2="24" y2="22" />
          <line x1="34" y1="13.5" x2="34" y2="22" />
          <line x1="2" y1="22" x2="46" y2="22" strokeWidth="2.5" />
        </svg>
      </span>
    </div>
  );
}
