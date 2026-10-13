"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession } from "@/lib/auth";
import { db } from "@/lib/db";

export type AuthState = { error?: string; email?: string } | undefined;

const DEFAULT_TYPES = [
  "Aérosol",
  "Tire-lait",
  "Déambulateur",
  "Fauteuil roulant",
  "Lit médicalisé",
  "Neurostimulateur (TENS)",
  "Béquilles",
];

const signupSchema = z.object({
  pharmacyName: z.string().trim().min(2, "Indiquez le nom de la pharmacie."),
  city: z.string().trim().optional(),
  name: z.string().trim().min(2, "Indiquez votre nom."),
  email: z.email("Adresse e-mail invalide.").trim().toLowerCase(),
  password: z.string().min(10, "Le mot de passe doit contenir au moins 10 caractères."),
});

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };
  const data = parsed.data;

  if (await db.user.findUnique({ where: { email: data.email } })) {
    return { error: "Un compte existe déjà avec cette adresse.", email };
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await db.$transaction(async (tx) => {
    const pharmacy = await tx.pharmacy.create({
      data: {
        name: data.pharmacyName,
        city: data.city || null,
        email: data.email,
        equipmentTypes: { create: DEFAULT_TYPES.map((name) => ({ name })) },
      },
    });
    return tx.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        role: "OWNER",
        pharmacyId: pharmacy.id,
      },
    });
  });

  await createSession(user.id);
  redirect("/app");
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  // Même message dans les deux cas pour ne pas révéler quels comptes existent
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "E-mail ou mot de passe incorrect.", email };
  }
  await createSession(user.id);
  redirect("/app");
}

export async function logout() {
  await destroySession();
  redirect("/connexion");
}
