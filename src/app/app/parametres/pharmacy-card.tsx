"use client";

import { useActionState, useState } from "react";
import { Field, FormError, Notice } from "@/components/ui";
import { updatePharmacy, type SettingsFormState } from "./actions";
import { InfoList, InfoRow, PencilIcon, SettingsCard } from "./settings-ui";

export type PharmacyValues = {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  siret: string;
};

export function PharmacyCard({ pharmacy }: { pharmacy: PharmacyValues }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: SettingsFormState, formData: FormData) => {
      const result = await updatePharmacy(prev, formData);
      // Retour à la lecture une fois l'enregistrement confirmé
      if (result?.ok) setEditing(false);
      return result;
    },
    undefined,
  );

  const fullAddress = [pharmacy.address, [pharmacy.postalCode, pharmacy.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return (
    <SettingsCard
      id="pharmacie"
      title="Pharmacie"
      description="Ces informations apparaissent en en-tête des contrats remis aux patients."
      action={
        !editing && (
          <button type="button" onClick={() => setEditing(true)} className="btn-secondary">
            <PencilIcon />
            Modifier
          </button>
        )
      }
    >
      {state?.ok && !editing && <Notice>{state.ok}</Notice>}

      {editing ? (
        <form action={action} className="space-y-4">
          <FormError message={state?.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom">
              <input name="name" required defaultValue={pharmacy.name} className="input" autoFocus />
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
            <Field label="SIRET" hint="Affiché en en-tête du contrat.">
              <input name="siret" inputMode="numeric" defaultValue={pharmacy.siret} className="input" />
            </Field>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)} disabled={pending}>
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <InfoList>
          <InfoRow label="Nom" value={pharmacy.name} />
          <InfoRow label="Adresse" value={fullAddress} />
          <InfoRow label="Téléphone" value={pharmacy.phone} />
          <InfoRow label="E-mail" value={pharmacy.email} />
          <InfoRow label="SIRET" value={pharmacy.siret} mono />
        </InfoList>
      )}
    </SettingsCard>
  );
}
