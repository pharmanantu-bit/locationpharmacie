// Les dates métier (début, fin, retour) sont des jours sans heure,
// stockés à minuit UTC. "Aujourd'hui" est calculé à l'heure de Paris.

export function todayUTC(): Date {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  return new Date(`${iso}T00:00:00Z`);
}

export function parseDay(value: FormDataEntryValue | null | undefined): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00Z`);
}

export function toInputDate(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function formatDay(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function formatEuros(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function parseEuros(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
