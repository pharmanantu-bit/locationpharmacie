import Link from "next/link";
import type { ReactNode } from "react";

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="card px-6 py-12 text-center">
      <p className="font-medium text-slate-900">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{children}</p>}
      {action && (
        <Link href={action.href} className="btn-primary mt-4">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-800">
      {children}
    </p>
  );
}
