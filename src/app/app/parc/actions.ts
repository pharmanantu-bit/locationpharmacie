"use server";

import type { EquipmentStatus, Ownership } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export type EquipmentFormState = { error?: string; ok?: boolean } | undefined;

function text(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function readFields(formData: FormData) {
  const ownership = text(formData, "ownership") === "SUPPLIER" ? "SUPPLIER" : "PHARMACY";
  return {
    label: text(formData, "label"),
    serialNumber: text(formData, "serialNumber"),
    ownership: ownership as Ownership,
    supplier: text(formData, "supplier"),
    notes: text(formData, "notes"),
  };
}

export async function createEquipment(_prev: EquipmentFormState, formData: FormData): Promise<EquipmentFormState> {
  const user = await requireUser();
  const typeId = text(formData, "typeId");
  const type = typeId ? await db.equipmentType.findFirst({ where: { id: typeId, pharmacyId: user.pharmacyId } }) : null;
  if (!type) return { error: "Choisissez le type de matériel." };
  const fields = readFields(formData);
  if (!fields.label) return { error: "Donnez un nom à l'appareil (marque, modèle ou n° d'inventaire)." };

  const equipment = await db.equipment.create({
    data: { ...fields, label: fields.label, pharmacyId: user.pharmacyId, typeId: type.id },
  });
  revalidatePath("/app", "layout");
  redirect(`/app/parc/${equipment.id}`);
}

export async function updateEquipment(_prev: EquipmentFormState, formData: FormData): Promise<EquipmentFormState> {
  const user = await requireUser();
  const equipment = await db.equipment.findFirst({
    where: { id: String(formData.get("equipmentId")), pharmacyId: user.pharmacyId },
  });
  if (!equipment) return { error: "Appareil introuvable." };
  const fields = readFields(formData);
  if (!fields.label) return { error: "Le nom de l'appareil est obligatoire." };

  // Le statut "En location" est piloté par les dossiers, pas modifiable à la main
  let status = equipment.status;
  const requested = text(formData, "status") as EquipmentStatus | null;
  if (equipment.status !== "RENTED" && requested && ["AVAILABLE", "MAINTENANCE", "RETIRED"].includes(requested)) {
    status = requested;
  }

  await db.equipment.update({
    where: { id: equipment.id },
    data: { ...fields, label: fields.label, status },
  });
  revalidatePath("/app", "layout");
  return { ok: true };
}
