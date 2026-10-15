"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl, stripe } from "@/lib/stripe";

// Lien d'onboarding Stripe (hébergé par Stripe) pour un compte connecté
async function onboardingUrl(accountId: string) {
  const link = await stripe!.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl()}/app/parametres?stripe=reprendre`,
    return_url: `${appUrl()}/app/parametres?stripe=retour`,
  });
  return link.url;
}

// Crée (si besoin) le compte Stripe Connect de la pharmacie puis envoie vers l'onboarding
export async function connectStripe() {
  const user = await requireOwner();
  if (!stripe) redirect("/app/parametres?stripe=non-configure");

  const pharmacy = await db.pharmacy.findUniqueOrThrow({ where: { id: user.pharmacyId } });
  let accountId = pharmacy.stripeAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "standard",
      country: "FR",
      email: pharmacy.email ?? user.email,
      business_profile: { name: pharmacy.name, mcc: "5912" }, // 5912 : pharmacies
      metadata: { pharmacyId: pharmacy.id },
    });
    accountId = account.id;
    await db.pharmacy.update({ where: { id: pharmacy.id }, data: { stripeAccountId: accountId } });
  }

  const url = await onboardingUrl(accountId);
  redirect(url);
}

// Retire le lien entre la pharmacie et son compte Stripe (le compte Stripe lui-même n'est pas supprimé)
export async function disconnectStripe() {
  const user = await requireOwner();
  const open = await db.deposit.count({
    where: { pharmacyId: user.pharmacyId, status: { in: ["PENDING", "AUTHORIZED"] } },
  });
  if (open > 0) redirect("/app/parametres?stripe=cautions-ouvertes");
  await db.pharmacy.update({ where: { id: user.pharmacyId }, data: { stripeAccountId: null } });
  revalidatePath("/app/parametres");
  redirect("/app/parametres?stripe=deconnecte");
}
