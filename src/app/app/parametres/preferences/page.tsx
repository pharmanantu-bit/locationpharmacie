import type { Metadata } from "next";
import { SubmitButton } from "@/components/submit-button";
import { Field } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { ensureCatalogue } from "@/lib/catalogue-server";
import { db } from "@/lib/db";
import { toggleTypeArchived, updateType } from "../actions";
import { ContractTermsForm, NewTypeForm, TypeFields } from "../settings-forms";
import { SettingsCard } from "../settings-ui";

export const metadata: Metadata = { title: "Préférences" };

export default async function PreferencesPage() {
  const user = await requireOwner();
  const [pharmacy, catalogue] = await Promise.all([
    db.pharmacy.findUniqueOrThrow({
      where: { id: user.pharmacyId },
      include: { equipmentTypes: { orderBy: [{ archived: "asc" }, { name: "asc" }] } },
    }),
    ensureCatalogue(),
  ]);
  const catalogueOptions = catalogue.map((c) => ({ id: c.id, name: c.name, category: c.category }));

  return (
    <>
      <SettingsCard
        id="types"
        title="Types de matériel"
        description="Valeurs proposées par défaut à la création d'un dossier : périodicité de facturation, durée habituelle, tarif par période et montant de la caution. Le rattachement au catalogue commun servira à l'annuaire public."
      >
        <div className="space-y-3">
          {pharmacy.equipmentTypes.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg border border-slate-200 p-3 ${t.archived ? "bg-slate-50 opacity-60" : ""}`}
            >
              <form action={updateType} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end 2xl:grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_auto]">
                <input type="hidden" name="typeId" value={t.id} />
                <Field label="Nom">
                  <input name="name" required defaultValue={t.name} className="input" />
                </Field>
                <TypeFields
                  catalogue={catalogueOptions}
                  catalogueId={t.catalogueId ?? ""}
                  billingPeriod={t.billingPeriod}
                  defaultDurationDays={t.defaultDurationDays?.toString() ?? ""}
                  price={t.priceCents != null ? String(t.priceCents / 100) : ""}
                  deposit={t.depositCents != null ? String(t.depositCents / 100) : ""}
                />
                <SubmitButton className="btn-secondary" pendingLabel="…">
                  Enregistrer
                </SubmitButton>
              </form>
              <form action={toggleTypeArchived} className="mt-2">
                <input type="hidden" name="typeId" value={t.id} />
                <button className="text-xs font-medium text-slate-500 hover:text-slate-900">
                  {t.archived ? "Réactiver ce type" : "Archiver ce type"}
                </button>
              </form>
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-slate-100 pt-5">
          <NewTypeForm catalogue={catalogueOptions} />
        </div>
      </SettingsCard>

      <SettingsCard
        id="contrat"
        title="Contrat de location"
        description="Conditions générales reprises sur le contrat PDF pré-rempli remis au patient."
      >
        <ContractTermsForm contractTerms={pharmacy.contractTerms ?? ""} />
      </SettingsCard>
    </>
  );
}
