"use client";

import { useActionState } from "react";
import { Field, FormError, Notice } from "@/components/ui";
import { DEFAULT_CONTRACT_TERMS } from "@/lib/contract-terms";
import { BILLING_LABELS } from "@/lib/rentals";
import { createType, updateContractTerms } from "./actions";

export type CatalogueOption = { id: string; name: string; category: string };

export function ContractTermsForm({ contractTerms }: { contractTerms: string }) {
  const [state, action, pending] = useActionState(updateContractTerms, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />
      {state?.ok && <Notice>{state.ok}</Notice>}
      <Field
        label="Conditions générales du contrat de location"
        hint="Laissez vide pour utiliser le modèle standard affiché en gris. Une ligne commençant par « # » devient un titre d'article. Faites relire ce texte par votre conseil juridique avant utilisation."
      >
        <textarea
          name="contractTerms"
          rows={14}
          defaultValue={contractTerms}
          placeholder={DEFAULT_CONTRACT_TERMS}
          className="input font-mono text-xs"
        />
      </Field>
      <button className="btn-primary" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

export function NewTypeForm({ catalogue }: { catalogue: CatalogueOption[] }) {
  const [state, action, pending] = useActionState(createType, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      {state?.ok && <Notice>{state.ok}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end 2xl:grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_auto]">
        <Field label="Nouveau type">
          <input name="name" required className="input" placeholder="Ex. Pèse-bébé" />
        </Field>
        <TypeFields catalogue={catalogue} />
        <button className="btn-secondary" disabled={pending}>
          Ajouter
        </button>
      </div>
    </form>
  );
}

export function TypeFields({
  catalogue,
  catalogueId = "",
  billingPeriod = "WEEKLY",
  defaultDurationDays = "",
  price = "",
  deposit = "",
}: {
  catalogue: CatalogueOption[];
  catalogueId?: string;
  billingPeriod?: string;
  defaultDurationDays?: string;
  price?: string;
  deposit?: string;
}) {
  const categories = Array.from(new Set(catalogue.map((c) => c.category)));
  return (
    <>
      <Field label="Catalogue commun" hint="Pour l'annuaire public.">
        <select name="catalogueId" defaultValue={catalogueId} className="input">
          <option value="">Non rattaché</option>
          {categories.map((cat) => (
            <optgroup key={cat} label={cat}>
              {catalogue
                .filter((c) => c.category === cat)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label="Facturation">
        <select name="billingPeriod" defaultValue={billingPeriod} className="input">
          {Object.entries(BILLING_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Durée (jours)">
        <input name="defaultDurationDays" type="number" min={1} defaultValue={defaultDurationDays} className="input" />
      </Field>
      <Field label="Tarif (€)">
        <input name="price" inputMode="decimal" defaultValue={price} className="input" />
      </Field>
      <Field label="Caution (€)">
        <input name="deposit" inputMode="decimal" defaultValue={deposit} className="input" />
      </Field>
    </>
  );
}
