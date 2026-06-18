/**
 * The Dildi logo mark — a suspension-bridge arc in a warm sunset tile.
 * Use everywhere the brand appears (sidebar, dashboard, login, etc.).
 */
export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#F2A65A] to-[#E27D6E] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)] ${className}`}
    >
      <svg viewBox="0 0 48 28" className="w-3/5" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round">
        <path d="M4 22 Q24 3 44 22" />
        <line x1="4" y1="22" x2="4" y2="15" />
        <line x1="44" y1="22" x2="44" y2="15" />
        <line x1="15" y1="13.5" x2="15" y2="22" />
        <line x1="24" y1="9.5" x2="24" y2="22" />
        <line x1="33" y1="13.5" x2="33" y2="22" />
        <line x1="2" y1="22" x2="46" y2="22" strokeWidth="3" />
      </svg>
    </span>
  );
}
