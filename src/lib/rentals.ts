import type { BillingPeriod, EquipmentStatus, Rental, RentalStatus } from "@prisma/client";
import { addDays, addMonths, todayUTC } from "./dates";

export const STATUS_LABELS: Record<RentalStatus, string> = {
  DRAFT: "En création",
  ORDERED: "Commandé",
  ACTIVE: "En cours",
  TO_CLOSE: "À clôturer",
  CLOSED: "Clôturé",
  CANCELLED: "Annulé",
};

export const STATUS_TONES: Record<RentalStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  ORDERED: "bg-amber-50 text-amber-800 ring-amber-200",
  ACTIVE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  TO_CLOSE: "bg-sky-50 text-sky-800 ring-sky-200",
  CLOSED: "bg-slate-50 text-slate-500 ring-slate-200",
  CANCELLED: "bg-slate-50 text-slate-400 ring-slate-200",
};

export const OPEN_STATUSES: RentalStatus[] = ["DRAFT", "ORDERED", "ACTIVE", "TO_CLOSE"];

export const BILLING_LABELS: Record<BillingPeriod, string> = {
  WEEKLY: "Hebdomadaire",
  MONTHLY: "Mensuelle",
  ONE_OFF: "Forfait unique",
};

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  AVAILABLE: "Disponible",
  RENTED: "En location",
  MAINTENANCE: "Nettoyage / révision",
  RETIRED: "Retiré du parc",
};

export const EQUIPMENT_STATUS_TONES: Record<EquipmentStatus, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  RENTED: "bg-sky-50 text-sky-800 ring-sky-200",
  MAINTENANCE: "bg-amber-50 text-amber-800 ring-amber-200",
  RETIRED: "bg-slate-50 text-slate-400 ring-slate-200",
};

type RentalDates = Pick<
  Rental,
  "status" | "startDate" | "plannedEndDate" | "returnDate" | "billingPeriod" | "billedUntil"
>;

export function isLate(r: RentalDates, today = todayUTC()): boolean {
  return r.status === "ACTIVE" && !!r.plannedEndDate && r.plannedEndDate < today;
}

// Date à partir de laquelle la prochaine période reste à facturer
export function nextBillingDate(r: RentalDates): Date | null {
  if (!r.startDate) return null;
  if (r.billingPeriod === "ONE_OFF") return r.billedUntil ? null : r.startDate;
  return r.billedUntil ?? r.startDate;
}

export function isBillingDue(r: RentalDates, today = todayUTC()): boolean {
  if (r.status !== "ACTIVE" && r.status !== "TO_CLOSE") return false;
  const next = nextBillingDate(r);
  if (!next || next > today) return false;
  return !r.returnDate || next < r.returnDate;
}

// Nouvelle valeur de billedUntil quand l'équipe a facturé une période dans le LGO
export function billedUntilAfter(r: RentalDates): Date | null {
  const next = nextBillingDate(r);
  if (!next) return r.billedUntil;
  if (r.billingPeriod === "ONE_OFF") return next;
  return r.billingPeriod === "WEEKLY" ? addDays(next, 7) : addMonths(next, 1);
}

export function rentalNumber(year: number, counter: number): string {
  return `LOC-${year}-${String(counter).padStart(4, "0")}`;
}
