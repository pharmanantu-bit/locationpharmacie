import type {
  BillingPeriod,
  EquipmentEventKind,
  EquipmentStatus,
  Rental,
  RentalSource,
  RentalStatus,
} from "@prisma/client";
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

export const SOURCE_LABELS: Record<RentalSource, string> = {
  PHARMACY_STOCK: "Parc de la pharmacie",
  SUPPLIER: "Commandé à un fournisseur",
};

export const BILLING_LABELS: Record<BillingPeriod, string> = {
  WEEKLY: "Hebdomadaire",
  MONTHLY: "Mensuelle",
  ONE_OFF: "Forfait unique",
};

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  AVAILABLE: "Disponible",
  RENTED: "En location",
  CLEANING: "En nettoyage",
  MAINTENANCE: "En maintenance",
  RETIRED: "Hors service",
};

export const EQUIPMENT_STATUS_TONES: Record<EquipmentStatus, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  RENTED: "bg-sky-50 text-sky-800 ring-sky-200",
  CLEANING: "bg-amber-50 text-amber-800 ring-amber-200",
  MAINTENANCE: "bg-orange-50 text-orange-800 ring-orange-200",
  RETIRED: "bg-slate-50 text-slate-400 ring-slate-200",
};

export const EQUIPMENT_EVENT_LABELS: Record<EquipmentEventKind, string> = {
  CREATED: "Entrée au parc",
  RENTED: "Remis à un patient",
  RETURNED: "Retour",
  CLEANED: "Nettoyage / désinfection",
  MAINTENANCE_START: "Envoi en maintenance",
  MAINTENANCE_END: "Retour de maintenance",
  STATUS_CHANGED: "Changement d'état",
  NOTE: "Note",
};

type RentalDates = Pick<
  Rental,
  "status" | "startDate" | "plannedEndDate" | "returnDate" | "billingPeriod" | "billedUntil"
>;

export function isLate(r: RentalDates, today = todayUTC()): boolean {
  return r.status === "ACTIVE" && !!r.plannedEndDate && r.plannedEndDate < today;
}

// Ordonnance : expirée, ou expire dans les 7 jours, pour un dossier encore ouvert
export type PrescriptionState = "none" | "valid" | "expiring" | "expired";

export function prescriptionState(
  r: Pick<Rental, "status" | "prescriptionExpiresAt">,
  today = todayUTC(),
): PrescriptionState {
  if (!r.prescriptionExpiresAt) return "none";
  if (r.status === "CLOSED" || r.status === "CANCELLED") return "valid";
  if (r.prescriptionExpiresAt < today) return "expired";
  if (r.prescriptionExpiresAt <= addDays(today, 7)) return "expiring";
  return "valid";
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

// Les 6 étapes du parcours d'un dossier (cahier des charges)
export const JOURNEY_STEPS = [
  { key: "patient", label: "Patient et matériel" },
  { key: "source", label: "Source du matériel" },
  { key: "prescription", label: "Ordonnance" },
  { key: "deposit", label: "Caution" },
  { key: "contract", label: "Contrat" },
  { key: "followup", label: "Suivi" },
] as const;

export type JourneyStepKey = (typeof JOURNEY_STEPS)[number]["key"];
