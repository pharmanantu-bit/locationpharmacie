"use server";

import type { EquipmentStatus, Ownership } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { parseDay } from "@/lib/dates";
import { db } from "@/lib/db";
import { logEquipmentEvent } from "@/lib/equipment";
import { EQUIPMENT_STATUS_LABELS } from "@/lib/rentals";

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
    purchaseDate: parseDay(formData.get("purchaseDate")),
    condition: text(formData, "condition"),
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

  const equipment = await db.$transaction(async (tx) => {
    const e = await tx.equipment.create({
      data: { ...fields, label: fields.label!, pharmacyId: user.pharmacyId, typeId: type.id },
    });
    await logEquipmentEvent(tx, user, e.id, "CREATED", "Entrée au parc");
    return e;
  });
  revalidatePath("/app", "layout");
  redirect(`/app/parc/${equipment.id}`);
}

export async function updateEquipment(_prev: EquipmentFormState, formData: FormData): Promise<EquipmentFormState> {
  const user = await requireUser();
  const equipment = await getEquipment(user, String(formData.get("equipmentId")));
  if (!equipment) return { error: "Appareil introuvable." };
  const fields = readFields(formData);
  if (!fields.label) return { error: "Le nom de l'appareil est obligatoire." };

  // Le statut "En location" est piloté par les dossiers, pas modifiable à la main
  let status = equipment.status;
  const requested = text(formData, "status") as EquipmentStatus | null;
  if (
    equipment.status !== "RENTED" &&
    requested &&
    ["AVAILABLE", "CLEANING", "MAINTENANCE", "RETIRED"].includes(requested)
  ) {
    status = requested;
  }

  await db.$transaction(async (tx) => {
    await tx.equipment.update({
      where: { id: equipment.id },
      data: { ...fields, label: fields.label!, status },
    });
    if (status !== equipment.status) {
      await logEquipmentEvent(
        tx,
        user,
        equipment.id,
        "STATUS_CHANGED",
        `${EQUIPMENT_STATUS_LABELS[equipment.status]} → ${EQUIPMENT_STATUS_LABELS[status]}`,
      );
    }
  });
  revalidatePath("/app", "layout");
  return { ok: true };
}

async function getEquipment(user: CurrentUser, id: string) {
  return db.equipment.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
}

function done(id: string) {
  revalidatePath("/app", "layout");
  redirect(`/app/parc/${id}`);
}

// Nettoyage / désinfection terminé : l'appareil redevient disponible
export async function markCleaned(formData: FormData) {
  const user = await requireUser();
  const equipment = await getEquipment(user, String(formData.get("equipmentId")));
  if (!equipment || equipment.status === "RENTED" || equipment.status === "RETIRED") return;
  const note = text(formData, "note");
  await db.$transaction(async (tx) => {
    await tx.equipment.update({
      where: { id: equipment.id },
      data: { status: "AVAILABLE", lastCleanedAt: new Date() },
    });
    await logEquipmentEvent(tx, user, equipment.id, "CLEANED", note ? `Nettoyé et désinfecté — ${note}` : "Nettoyé et désinfecté");
  });
  done(equipment.id);
}

export async function sendToMaintenance(formData: FormData) {
  const user = await requireUser();
  const equipment = await getEquipment(user, String(formData.get("equipmentId")));
  if (!equipment || equipment.status === "RENTED" || equipment.status === "RETIRED") return;
  const note = text(formData, "note");
  await db.$transaction(async (tx) => {
    await tx.equipment.update({ where: { id: equipment.id }, data: { status: "MAINTENANCE" } });
    await logEquipmentEvent(tx, user, equipment.id, "MAINTENANCE_START", note ? `Envoyé en maintenance — ${note}` : "Envoyé en maintenance");
  });
  done(equipment.id);
}

export async function endMaintenance(formData: FormData) {
  const user = await requireUser();
  const equipment = await getEquipment(user, String(formData.get("equipmentId")));
  if (!equipment || equipment.status !== "MAINTENANCE") return;
  const note = text(formData, "note");
  await db.$transaction(async (tx) => {
    await tx.equipment.update({ where: { id: equipment.id }, data: { status: "AVAILABLE" } });
    await logEquipmentEvent(tx, user, equipment.id, "MAINTENANCE_END", note ? `Retour de maintenance — ${note}` : "Retour de maintenance, remis en service");
  });
  done(equipment.id);
}

export async function addEquipmentNote(formData: FormData) {
  const user = await requireUser();
  const equipment = await getEquipment(user, String(formData.get("equipmentId")));
  const note = text(formData, "note");
  if (!equipment || !note) return;
  await db.$transaction(async (tx) => {
    await logEquipmentEvent(tx, user, equipment.id, "NOTE", note);
  });
  done(equipment.id);
}
