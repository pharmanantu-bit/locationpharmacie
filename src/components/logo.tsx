export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-lg bg-brand-700 text-white">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </span>
      <span className={`text-[15px] font-semibold tracking-tight ${light ? "text-white" : "text-slate-900"}`}>
        locationenpharmacie
        <span className={light ? "text-brand-100" : "text-brand-700"}>.com</span>
      </span>
    </span>
  );
}
