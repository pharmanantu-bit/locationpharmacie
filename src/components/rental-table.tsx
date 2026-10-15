import Link from "next/link";
import type { Equipment, EquipmentType, Patient, Rental } from "@prisma/client";
import { formatDay, todayUTC } from "@/lib/dates";
import { isBillingDue, isLate, prescriptionState, STATUS_LABELS } from "@/lib/rentals";

export type RentalRow = Rental & {
  patient: Patient;
  type: EquipmentType;
  equipment: Equipment | null;
};

// Pastille de statut : couleur du point + fond pâle, comme sur les outils du marché
const DOT: Record<string, string> = {
  DRAFT: "bg-amber-50 text-amber-800 before:bg-amber-500",
  ORDERED: "bg-sky-50 text-sky-800 before:bg-sky-500",
  ACTIVE: "bg-emerald-50 text-emerald-800 before:bg-emerald-500",
  TO_CLOSE: "bg-violet-50 text-violet-800 before:bg-violet-500",
  CLOSED: "bg-slate-100 text-slate-600 before:bg-slate-400",
  CANCELLED: "bg-slate-50 text-slate-400 before:bg-slate-300",
  late: "bg-red-50 text-red-700 before:bg-red-500",
  billing: "bg-violet-50 text-violet-700 before:bg-violet-500",
  expired: "bg-red-50 text-red-700 before:bg-red-500",
  expiring: "bg-amber-50 text-amber-800 before:bg-amber-500",
};

export function StatusPill({ kind, children }: { kind: keyof typeof DOT; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium before:size-1.5 before:rounded-full before:content-[''] ${DOT[kind]}`}
    >
      {children}
    </span>
  );
}

export function RentalTable({ rentals, showPatient = true }: { rentals: RentalRow[]; showPatient?: boolean }) {
  const today = todayUTC();
  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead>
          <tr>
            {showPatient && <th className="table-head">Patient</th>}
            <th className="table-head">Matériel</th>
            <th className="table-head">Statut</th>
            <th className="table-head">Début</th>
            <th className="table-head">Fin</th>
            <th className="table-head">N° dossier</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rentals.map((r) => {
            const late = isLate(r, today);
            const billing = isBillingDue(r, today);
            const prescription = prescriptionState(r, today);
            return (
              <tr key={r.id} className="hover:bg-slate-50">
                {showPatient && (
                  <td className="cell font-semibold text-slate-900">
                    <Link href={`/app/dossiers/${r.id}`} className="hover:underline">
                      {r.patient.lastName.toUpperCase()} {r.patient.firstName}
                    </Link>
                  </td>
                )}
                <td className="cell">
                  <span className="text-slate-700">{r.type.name}</span>
                  {r.equipment && <span className="block text-xs text-slate-500">{r.equipment.label}</span>}
                </td>
                <td className="cell">
                  <div className="flex flex-wrap gap-1">
                    <StatusPill kind={r.status}>{STATUS_LABELS[r.status]}</StatusPill>
                    {late && <StatusPill kind="late">En retard</StatusPill>}
                    {billing && <StatusPill kind="billing">À facturer</StatusPill>}
                    {prescription === "expired" && <StatusPill kind="expired">Ordonnance expirée</StatusPill>}
                    {prescription === "expiring" && <StatusPill kind="expiring">Ordonnance expire bientôt</StatusPill>}
                  </div>
                </td>
                <td className="cell whitespace-nowrap text-slate-600">{formatDay(r.startDate)}</td>
                <td className={`cell whitespace-nowrap ${late ? "font-medium text-red-700" : "text-slate-600"}`}>
                  {formatDay(r.plannedEndDate)}
                </td>
                <td className="cell">
                  <Link href={`/app/dossiers/${r.id}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">
                    {r.number}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
