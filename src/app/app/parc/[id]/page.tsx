import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RentalTable } from "@/components/rental-table";
import { Badge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUS_TONES } from "@/lib/rentals";
import { EquipmentForm } from "../equipment-form";

export const metadata: Metadata = { title: "Appareil" };

export default async function EquipmentDetailPage({ params }: PageProps<"/app/parc/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const equipment = await db.equipment.findFirst({
    where: { id, pharmacyId: user.pharmacyId },
    include: {
      type: true,
      rentals: { include: { patient: true, type: true, equipment: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!equipment) notFound();

  return (
    <>
      <div className="mb-6">
        <Link href="/app/parc" className="text-sm text-slate-500 hover:text-slate-900">
          ← Parc
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{equipment.label}</h1>
          <Badge tone={EQUIPMENT_STATUS_TONES[equipment.status]}>{EQUIPMENT_STATUS_LABELS[equipment.status]}</Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {equipment.type.name}
          {equipment.serialNumber && ` · n° ${equipment.serialNumber}`} · {equipment.rentals.length} location
          {equipment.rentals.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="card mb-8 max-w-3xl p-5">
        <EquipmentForm
          initial={{
            id: equipment.id,
            label: equipment.label,
            serialNumber: equipment.serialNumber,
            ownership: equipment.ownership,
            supplier: equipment.supplier,
            status: equipment.status,
            notes: equipment.notes,
          }}
        />
      </div>

      <h2 className="mb-3 text-base font-semibold text-slate-900">Historique des locations</h2>
      {equipment.rentals.length === 0 ? (
        <p className="text-sm text-slate-500">Cet appareil n&apos;a pas encore été loué.</p>
      ) : (
        <RentalTable rentals={equipment.rentals} />
      )}
    </>
  );
}
