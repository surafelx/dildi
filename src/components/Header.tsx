export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="rise px-1 pb-3 pt-1">
      <h1 className="serif text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-ink/70">{subtitle}</p>}
    </header>
  );
}
