import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RentalTable } from "@/components/rental-table";
import { requireUser } from "@/lib/auth";
import { toInputDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { PatientForm } from "./patient-form";

export const metadata: Metadata = { title: "Patient" };

export default async function PatientPage({ params }: PageProps<"/app/patients/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const patient = await db.patient.findFirst({
    where: { id, pharmacyId: user.pharmacyId },
    include: { rentals: { include: { patient: true, type: true, equipment: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!patient) notFound();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/app/patients" className="text-sm text-slate-500 hover:text-slate-900">
            ← Patients
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {patient.lastName.toUpperCase()} {patient.firstName}
          </h1>
        </div>
        <Link href={`/app/dossiers/nouveau?patient=${patient.id}`} className="btn-primary">
          Nouvelle location
        </Link>
      </div>

      <div className="card mb-8 max-w-3xl p-5">
        <PatientForm
          patient={{
            id: patient.id,
            lastName: patient.lastName,
            firstName: patient.firstName,
            phone: patient.phone ?? "",
            email: patient.email ?? "",
            address: patient.address ?? "",
            birthDate: toInputDate(patient.birthDate),
            notes: patient.notes ?? "",
          }}
        />
      </div>

      <h2 className="mb-3 text-base font-semibold text-slate-900">Locations</h2>
      {patient.rentals.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune location.</p>
      ) : (
        <RentalTable rentals={patient.rentals} showPatient={false} />
      )}
    </>
  );
}
