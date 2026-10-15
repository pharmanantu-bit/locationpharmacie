"use server";

import type { BillingPeriod } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { parseEuros } from "@/lib/dates";
import { db } from "@/lib/db";

export type SettingsFormState = { error?: string; ok?: string } | undefined;

const BILLING_PERIODS: BillingPeriod[] = ["WEEKLY", "MONTHLY", "ONE_OFF"];

function text(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function updatePharmacy(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireOwner();
  const name = text(formData, "name");
  if (!name) return { error: "Le nom de la pharmacie est obligatoire." };
  await db.pharmacy.update({
    where: { id: user.pharmacyId },
    data: {
      name,
      address: text(formData, "address"),
      postalCode: text(formData, "postalCode"),
      city: text(formData, "city"),
      phone: text(formData, "phone"),
      email: text(formData, "email"),
      siret: text(formData, "siret"),
      contractTerms: text(formData, "contractTerms"),
    },
  });
  revalidatePath("/app", "layout");
  return { ok: "Informations enregistrées." };
}

async function readType(formData: FormData) {
  const billingPeriod = text(formData, "billingPeriod") as BillingPeriod;
  const duration = Number(text(formData, "defaultDurationDays"));
  const catalogueId = text(formData, "catalogueId");
  const catalogue = catalogueId ? await db.catalogueItem.findUnique({ where: { id: catalogueId } }) : null;
  return {
    name: text(formData, "name"),
    catalogueId: catalogue?.id ?? null,
    billingPeriod: BILLING_PERIODS.includes(billingPeriod) ? billingPeriod : "WEEKLY",
    defaultDurationDays: Number.isInteger(duration) && duration > 0 ? duration : null,
    priceCents: parseEuros(formData.get("price")),
    depositCents: parseEuros(formData.get("deposit")),
  };
}

export async function createType(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireOwner();
  const data = await readType(formData);
  if (!data.name) return { error: "Indiquez le nom du type de matériel." };
  const exists = await db.equipmentType.findFirst({ where: { pharmacyId: user.pharmacyId, name: data.name } });
  if (exists) return { error: "Ce type existe déjà." };
  await db.equipmentType.create({ data: { ...data, name: data.name, pharmacyId: user.pharmacyId } });
  revalidatePath("/app", "layout");
  return { ok: `« ${data.name} » ajouté.` };
}

export async function updateType(formData: FormData) {
  const user = await requireOwner();
  const type = await db.equipmentType.findFirst({
    where: { id: String(formData.get("typeId")), pharmacyId: user.pharmacyId },
  });
  if (!type) return;
  const data = await readType(formData);
  await db.equipmentType.update({
    where: { id: type.id },
    data: { ...data, name: data.name ?? type.name },
  });
  revalidatePath("/app", "layout");
}

export async function toggleTypeArchived(formData: FormData) {
  const user = await requireOwner();
  const type = await db.equipmentType.findFirst({
    where: { id: String(formData.get("typeId")), pharmacyId: user.pharmacyId },
  });
  if (!type) return;
  await db.equipmentType.update({ where: { id: type.id }, data: { archived: !type.archived } });
  revalidatePath("/app", "layout");
}

const memberSchema = z.object({
  name: z.string().trim().min(2, "Indiquez le nom."),
  email: z.email("Adresse e-mail invalide.").trim().toLowerCase(),
  password: z.string().min(10, "Le mot de passe provisoire doit contenir au moins 10 caractères."),
});

export async function addMember(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireOwner();
  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { error: "Un compte existe déjà avec cette adresse." };
  await db.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: "MEMBER", pharmacyId: user.pharmacyId },
  });
  revalidatePath("/app/parametres");
  return { ok: `${name} peut maintenant se connecter avec ${email} et le mot de passe provisoire.` };
}

export async function removeMember(formData: FormData) {
  const user = await requireOwner();
  const memberId = String(formData.get("userId"));
  if (memberId === user.id) return;
  await db.user.deleteMany({ where: { id: memberId, pharmacyId: user.pharmacyId, role: "MEMBER" } });
  revalidatePath("/app/parametres");
}
