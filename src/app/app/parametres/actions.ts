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
    },
  });
  revalidatePath("/app", "layout");
  return { ok: "Informations enregistrées." };
}

export async function updateContractTerms(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireOwner();
  await db.pharmacy.update({
    where: { id: user.pharmacyId },
    data: { contractTerms: text(formData, "contractTerms") },
  });
  revalidatePath("/app", "layout");
  return { ok: "Conditions du contrat enregistrées." };
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

const memberUpdateSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(2, "Indiquez le nom."),
  password: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v === "" || v.length >= 10, "Le nouveau mot de passe doit contenir au moins 10 caractères."),
});

// Modification d'un opérateur par l'administrateur : nom et, au besoin, nouveau mot de passe
export async function updateMember(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireOwner();
  const parsed = memberUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { userId, name, password } = parsed.data;
  const member = await db.user.findFirst({ where: { id: userId, pharmacyId: user.pharmacyId, role: "MEMBER" } });
  if (!member) return { error: "Opérateur introuvable." };
  await db.user.update({
    where: { id: member.id },
    data: { name, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
  });
  if (password) {
    // Un mot de passe réinitialisé ferme les sessions ouvertes de l'opérateur
    await db.session.deleteMany({ where: { userId: member.id } });
  }
  revalidatePath("/app/parametres");
  return { ok: password ? `${name} : nom et mot de passe mis à jour.` : `${name} : nom mis à jour.` };
}

const accountSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom."),
  email: z.email("Adresse e-mail invalide.").trim().toLowerCase(),
});

// Compte de l'administrateur connecté : nom et adresse de connexion
export async function updateAccount(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireOwner();
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email } = parsed.data;
  const taken = await db.user.findUnique({ where: { email } });
  if (taken && taken.id !== user.id) return { error: "Un autre compte utilise déjà cette adresse." };
  await db.user.update({ where: { id: user.id }, data: { name, email } });
  revalidatePath("/app", "layout");
  return { ok: "Compte mis à jour." };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Saisissez votre mot de passe actuel."),
    password: z.string().min(10, "Le nouveau mot de passe doit contenir au moins 10 caractères."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Les deux saisies du nouveau mot de passe diffèrent.", path: ["confirm"] });

export async function changePassword(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireOwner();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const account = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(parsed.data.current, account.passwordHash))) {
    return { error: "Le mot de passe actuel est incorrect." };
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) } });
  return { ok: "Mot de passe modifié." };
}

export async function removeMember(formData: FormData) {
  const user = await requireOwner();
  const memberId = String(formData.get("userId"));
  if (memberId === user.id) return;
  await db.user.deleteMany({ where: { id: memberId, pharmacyId: user.pharmacyId, role: "MEMBER" } });
  revalidatePath("/app/parametres");
}
