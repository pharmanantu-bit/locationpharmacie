"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { parseDay } from "@/lib/dates";
import { db } from "@/lib/db";

export type PatientFormState = { error?: string; ok?: boolean } | undefined;

function text(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function updatePatient(_prev: PatientFormState, formData: FormData): Promise<PatientFormState> {
  const user = await requireUser();
  const patient = await db.patient.findFirst({
    where: { id: String(formData.get("patientId")), pharmacyId: user.pharmacyId },
  });
  if (!patient) return { error: "Patient introuvable." };
  const lastName = text(formData, "lastName");
  const firstName = text(formData, "firstName");
  if (!lastName || !firstName) return { error: "Le nom et le prénom sont obligatoires." };

  await db.patient.update({
    where: { id: patient.id },
    data: {
      lastName,
      firstName,
      phone: text(formData, "phone"),
      email: text(formData, "email"),
      address: text(formData, "address"),
      birthDate: parseDay(formData.get("birthDate")),
      notes: text(formData, "notes"),
    },
  });
  revalidatePath("/app", "layout");
  return { ok: true };
}
