"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MANUAL_STEPS } from "@/lib/onboarding";

// Coche ou décoche une étape manuelle du guide « Bien démarrer »
export async function toggleOnboardingStep(formData: FormData) {
  const user = await requireUser();
  const key = String(formData.get("step"));
  if (!(MANUAL_STEPS as readonly string[]).includes(key)) throw new Error("Étape inconnue.");

  const pharmacy = await db.pharmacy.findUniqueOrThrow({
    where: { id: user.pharmacyId },
    select: { onboardingDone: true },
  });
  const done = new Set(pharmacy.onboardingDone);
  if (done.has(key)) done.delete(key);
  else done.add(key);
  await db.pharmacy.update({ where: { id: user.pharmacyId }, data: { onboardingDone: Array.from(done) } });

  revalidatePath("/app", "layout");
  redirect("/app/bien-demarrer");
}
