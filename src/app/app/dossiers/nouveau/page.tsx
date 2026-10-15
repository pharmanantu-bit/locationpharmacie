import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { NewRentalForm } from "./new-rental-form";

export const metadata: Metadata = { title: "Nouveau dossier" };

export default async function NewRentalPage({ searchParams }: PageProps<"/app/dossiers/nouveau">) {
  const user = await requireUser();
  const { patient } = await searchParams;

  const [types, equipment, patients] = await Promise.all([
    db.equipmentType.findMany({
      where: { pharmacyId: user.pharmacyId, archived: false },
      orderBy: { name: "asc" },
    }),
    db.equipment.findMany({
      where: { pharmacyId: user.pharmacyId, status: "AVAILABLE" },
      orderBy: { label: "asc" },
    }),
    db.patient.findMany({
      where: { pharmacyId: user.pharmacyId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, phone: true, smsConsent: true },
    }),
  ]);

  return (
    <>
      <PageHeader title="Nouveau dossier de location" subtitle="Patient, matériel, source, ordonnance : trois étapes puis création." />
      <NewRentalForm
        types={types.map((t) => ({
          id: t.id,
          name: t.name,
          billingPeriod: t.billingPeriod,
          defaultDurationDays: t.defaultDurationDays,
          depositCents: t.depositCents,
        }))}
        equipment={equipment.map((e) => ({ id: e.id, typeId: e.typeId, label: e.label, serialNumber: e.serialNumber }))}
        patients={patients}
        initialPatientId={typeof patient === "string" ? patient : undefined}
      />
    </>
  );
}
