import type { Metadata } from "next";
import { SubmitButton } from "@/components/submit-button";
import { Field, PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { ensureCatalogue } from "@/lib/catalogue-server";
import { db } from "@/lib/db";
import { getConnectStatus, isStripeConfigured, stripeMode } from "@/lib/stripe";
import { removeMember, toggleTypeArchived, updateType } from "./actions";
import { AddMemberForm, NewTypeForm, PharmacyForm, TypeFields } from "./settings-forms";
import { StripeSection } from "./stripe-section";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage({ searchParams }: PageProps<"/app/parametres">) {
  const user = await requireOwner();
  const { stripe: stripeFlash } = await searchParams;
  const [pharmacy, catalogue] = await Promise.all([
    db.pharmacy.findUniqueOrThrow({
      where: { id: user.pharmacyId },
      include: {
        equipmentTypes: { orderBy: [{ archived: "asc" }, { name: "asc" }] },
        users: { orderBy: { createdAt: "asc" } },
      },
    }),
    ensureCatalogue(),
  ]);
  const catalogueOptions = catalogue.map((c) => ({ id: c.id, name: c.name, category: c.category }));
  const connectStatus = pharmacy.stripeAccountId ? await getConnectStatus(pharmacy.stripeAccountId) : null;

  return (
    <>
      <PageHeader title="Paramètres" />

      <div className="space-y-8">
        <section className="card p-5">
          <h2 className="mb-1 font-semibold text-slate-900">Pharmacie</h2>
          <p className="mb-4 text-sm text-slate-500">Ces informations apparaîtront sur les contrats de location.</p>
          <PharmacyForm
            pharmacy={{
              name: pharmacy.name,
              address: pharmacy.address ?? "",
              postalCode: pharmacy.postalCode ?? "",
              city: pharmacy.city ?? "",
              phone: pharmacy.phone ?? "",
              email: pharmacy.email ?? "",
            }}
          />
        </section>

        <StripeSection
          configured={isStripeConfigured()}
          mode={stripeMode()}
          accountId={pharmacy.stripeAccountId}
          status={connectStatus}
          flash={typeof stripeFlash === "string" ? stripeFlash : undefined}
        />

        <section className="card p-5">
          <h2 className="mb-1 font-semibold text-slate-900">Types de matériel</h2>
          <p className="mb-4 text-sm text-slate-500">
            Valeurs proposées par défaut à la création d&apos;un dossier : périodicité de facturation, durée habituelle
            et montant de la caution. Le rattachement au catalogue commun servira à l&apos;annuaire public.
          </p>
          <div className="space-y-3">
            {pharmacy.equipmentTypes.map((t) => (
              <div
                key={t.id}
                className={`rounded-lg border border-slate-200 p-3 ${t.archived ? "bg-slate-50 opacity-60" : ""}`}
              >
                <form
                  action={updateType}
                  className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] sm:items-end"
                >
                  <input type="hidden" name="typeId" value={t.id} />
                  <Field label="Nom">
                    <input name="name" required defaultValue={t.name} className="input" />
                  </Field>
                  <TypeFields
                    catalogue={catalogueOptions}
                    catalogueId={t.catalogueId ?? ""}
                    billingPeriod={t.billingPeriod}
                    defaultDurationDays={t.defaultDurationDays?.toString() ?? ""}
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
        </section>

        <section className="card p-5">
          <h2 className="mb-1 font-semibold text-slate-900">Équipe</h2>
          <p className="mb-4 text-sm text-slate-500">
            Chaque membre de l&apos;équipe a son propre accès. Les actions sont tracées à son nom dans l&apos;historique
            des dossiers.
          </p>
          <ul className="mb-5 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {pharmacy.users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">
                    {u.name}
                    {u.role === "OWNER" && <span className="ml-2 text-xs font-normal text-slate-500">Administrateur</span>}
                  </p>
                  <p className="text-slate-500">{u.email}</p>
                </div>
                {u.role === "MEMBER" && (
                  <form action={removeMember}>
                    <input type="hidden" name="userId" value={u.id} />
                    <SubmitButton className="btn-danger" pendingLabel="…" confirm={`Retirer l'accès de ${u.name} ?`}>
                      Retirer
                    </SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <AddMemberForm />
        </section>
      </div>
    </>
  );
}
