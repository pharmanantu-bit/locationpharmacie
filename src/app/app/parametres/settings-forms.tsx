"use client";

import { useActionState } from "react";
import { Field, FormError, Notice } from "@/components/ui";
import { BILLING_LABELS } from "@/lib/rentals";
import { addMember, createType, updatePharmacy } from "./actions";

type PharmacyValues = {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
};

export function PharmacyForm({ pharmacy }: { pharmacy: PharmacyValues }) {
  const [state, action, pending] = useActionState(updatePharmacy, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />
      {state?.ok && <Notice>{state.ok}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom">
          <input name="name" required defaultValue={pharmacy.name} className="input" />
        </Field>
        <Field label="Téléphone">
          <input name="phone" type="tel" defaultValue={pharmacy.phone} className="input" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Adresse">
            <input name="address" defaultValue={pharmacy.address} className="input" />
          </Field>
        </div>
        <Field label="Code postal">
          <input name="postalCode" defaultValue={pharmacy.postalCode} className="input" />
        </Field>
        <Field label="Ville">
          <input name="city" defaultValue={pharmacy.city} className="input" />
        </Field>
        <Field label="E-mail">
          <input name="email" type="email" defaultValue={pharmacy.email} className="input" />
        </Field>
      </div>
      <button className="btn-secondary" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

export function NewTypeForm() {
  const [state, action, pending] = useActionState(createType, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      {state?.ok && <Notice>{state.ok}</Notice>}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
        <Field label="Nouveau type">
          <input name="name" required className="input" placeholder="Ex. Pèse-bébé" />
        </Field>
        <TypeFields />
        <button className="btn-secondary" disabled={pending}>
          Ajouter
        </button>
      </div>
    </form>
  );
}

export function TypeFields({
  billingPeriod = "WEEKLY",
  defaultDurationDays = "",
  deposit = "",
}: {
  billingPeriod?: string;
  defaultDurationDays?: string;
  deposit?: string;
}) {
  return (
    <>
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
      <Field label="Caution (€)">
        <input name="deposit" inputMode="decimal" defaultValue={deposit} className="input" />
      </Field>
    </>
  );
}

export function AddMemberForm() {
  const [state, action, pending] = useActionState(addMember, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.error} />
      {state?.ok && <Notice>{state.ok}</Notice>}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <Field label="Nom">
          <input name="name" required className="input" />
        </Field>
        <Field label="E-mail">
          <input name="email" type="email" required className="input" />
        </Field>
        <Field label="Mot de passe provisoire">
          <input name="password" type="text" required minLength={10} className="input" autoComplete="off" />
        </Field>
        <button className="btn-secondary" disabled={pending}>
          Ajouter
        </button>
      </div>
    </form>
  );
}
