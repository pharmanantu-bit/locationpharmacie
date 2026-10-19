import type { ReactNode } from "react";

// Carte de réglages : titre, description facultative et action en haut à droite
export function SettingsCard({
  id,
  title,
  description,
  action,
  badge,
  children,
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="card scroll-mt-6 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {badge}
          </div>
          {description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}

// Ligne « libellé / valeur » en lecture seule, avec « Non renseigné » quand la valeur est vide
export function InfoRow({ label, value, mono }: { label: string; value?: ReactNode; mono?: boolean }) {
  const empty = value == null || value === "";
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[160px_1fr] sm:items-baseline sm:gap-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className={`text-[15px] ${empty ? "text-slate-400" : "text-slate-900"} ${mono && !empty ? "font-mono text-sm" : ""}`}>
        {empty ? "Non renseigné" : value}
      </dd>
    </div>
  );
}

export function InfoList({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-slate-100">{children}</dl>;
}

export function PencilIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z M13 7l3 3" />
    </svg>
  );
}

export function PlusIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-100 ${
        size === "lg" ? "size-14 text-lg" : "size-11 text-sm"
      }`}
    >
      {initials || "?"}
    </span>
  );
}
