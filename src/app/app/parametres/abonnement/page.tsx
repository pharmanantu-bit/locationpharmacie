import type { Metadata } from "next";
import { Badge } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { InfoList, InfoRow, SettingsCard } from "../settings-ui";

export const metadata: Metadata = { title: "Abonnement" };

const PLANS = {
  PER_RENTAL: {
    label: "À l'usage",
    price: "5 € par nouveau dossier",
    description: "Aucun engagement : vous ne payez que lorsqu'un dossier de location est créé.",
  },
  UNLIMITED: {
    label: "Illimité",
    price: "Abonnement mensuel",
    description: "Dossiers illimités pour un montant fixe chaque mois.",
  },
} as const;

export default async function SubscriptionPage() {
  const user = await requireOwner();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [pharmacy, thisMonth, total] = await Promise.all([
    db.pharmacy.findUniqueOrThrow({ where: { id: user.pharmacyId }, select: { plan: true, createdAt: true } }),
    db.rental.count({ where: { pharmacyId: user.pharmacyId, createdAt: { gte: monthStart } } }),
    db.rental.count({ where: { pharmacyId: user.pharmacyId } }),
  ]);
  const plan = PLANS[pharmacy.plan];
  const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(now);

  return (
    <>
      <SettingsCard
        id="offre"
        title="Votre offre"
        description={plan.description}
        badge={<Badge tone="bg-brand-50 text-brand-700 ring-brand-100">{plan.label}</Badge>}
      >
        <InfoList>
          <InfoRow label="Tarif" value={plan.price} />
          <InfoRow label="Dossiers ce mois-ci" value={`${thisMonth} (${monthLabel})`} />
          <InfoRow label="Dossiers depuis l'ouverture" value={String(total)} />
          <InfoRow
            label="Client depuis"
            value={new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(pharmacy.createdAt)}
          />
        </InfoList>
      </SettingsCard>

      <SettingsCard
        id="facturation"
        title="Facturation"
        description="La facturation de la plateforme n'est pas encore active : aucun prélèvement n'est effectué pendant la phase de lancement."
      >
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Le changement d&apos;offre et le téléchargement des factures seront disponibles ici dès l&apos;ouverture de la
          facturation. Vous serez prévenu avant tout premier prélèvement.
        </p>
      </SettingsCard>
    </>
  );
}
