import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { getConnectStatus, isStripeConfigured, stripeMode } from "@/lib/stripe";
import { StripeSection } from "../stripe-section";

export const metadata: Metadata = { title: "Empreinte bancaire" };

export default async function BankImprintPage({ searchParams }: PageProps<"/app/parametres/empreinte-bancaire">) {
  const user = await requireOwner();
  const { stripe: stripeFlash } = await searchParams;
  const pharmacy = await db.pharmacy.findUniqueOrThrow({ where: { id: user.pharmacyId } });
  const connectStatus = pharmacy.stripeAccountId ? await getConnectStatus(pharmacy.stripeAccountId) : null;

  return (
    <StripeSection
      configured={isStripeConfigured()}
      mode={stripeMode()}
      accountId={pharmacy.stripeAccountId}
      status={connectStatus}
      flash={typeof stripeFlash === "string" ? stripeFlash : undefined}
    />
  );
}
