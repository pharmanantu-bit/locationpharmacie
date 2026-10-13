import Link from "next/link";
import type { Equipment, EquipmentType, Patient, Rental } from "@prisma/client";
import { Badge } from "./ui";
import { formatDay, todayUTC } from "@/lib/dates";
import { isBillingDue, isLate, STATUS_LABELS, STATUS_TONES } from "@/lib/rentals";

export type RentalRow = Rental & {
  patient: Patient;
  type: EquipmentType;
  equipment: Equipment | null;
};

export function RentalTable({ rentals, showPatient = true }: { rentals: RentalRow[]; showPatient?: boolean }) {
  const today = todayUTC();
  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="table-head">Dossier</th>
            {showPatient && <th className="table-head">Patient</th>}
            <th className="table-head">Matériel</th>
            <th className="table-head">Statut</th>
            <th className="table-head">Début</th>
            <th className="table-head">Fin prévue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rentals.map((r) => {
            const late = isLate(r, today);
            const billing = isBillingDue(r, today);
            return (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="cell">
                  <Link href={`/app/dossiers/${r.id}`} className="font-medium text-brand-700 hover:underline">
                    {r.number}
                  </Link>
                </td>
                {showPatient && (
                  <td className="cell font-medium text-slate-900">
                    <Link href={`/app/patients/${r.patient.id}`} className="hover:underline">
                      {r.patient.lastName.toUpperCase()} {r.patient.firstName}
                    </Link>
                  </td>
                )}
                <td className="cell">
                  {r.type.name}
                  {r.equipment && <span className="block text-xs text-slate-500">{r.equipment.label}</span>}
                </td>
                <td className="cell">
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                    {late && <Badge tone="bg-red-50 text-red-700 ring-red-200">En retard</Badge>}
                    {billing && <Badge tone="bg-violet-50 text-violet-700 ring-violet-200">À facturer</Badge>}
                  </div>
                </td>
                <td className="cell whitespace-nowrap">{formatDay(r.startDate)}</td>
                <td className={`cell whitespace-nowrap ${late ? "font-medium text-red-700" : ""}`}>
                  {formatDay(r.plannedEndDate)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
