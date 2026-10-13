"use client";

import type { BillingPeriod } from "@prisma/client";
import { useActionState } from "react";
import { Field, FormError, Notice } from "@/components/ui";
import { BILLING_LABELS } from "@/lib/rentals";
import { markReturned, startRental, updateRental } from "../actions";

export function StartForm({
  rentalId,
  equipment,
  startDate,
  plannedEndDate,
}: {
  rentalId: string;
  equipment: { id: string; label: string; serialNumber: string | null }[];
  startDate: string;
  plannedEndDate: string;
}) {
  const [state, action, pending] = useActionState(startRental, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="rentalId" value={rentalId} />
      <FormError message={state?.error} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Appareil">
          <select name="equipmentId" className="input" defaultValue="">
            <option value="">Non attribué</option>
            {equipment.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
                {e.serialNumber ? ` — n° ${e.serialNumber}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Remis le">
          <input name="startDate" type="date" required defaultValue={startDate} className="input" />
        </Field>
        <Field label="Fin prévue">
          <input name="plannedEndDate" type="date" defaultValue={plannedEndDate} className="input" />
        </Field>
      </div>
      <button className="btn-primary" disabled={pending}>
        {pending ? "Enregistrement…" : "Remettre au patient"}
      </button>
    </form>
  );
}

export function ReturnForm({
  rentalId,
  today,
  hasEquipment,
}: {
  rentalId: string;
  today: string;
  hasEquipment: boolean;
}) {
  const [state, action, pending] = useActionState(markReturned, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="rentalId" value={rentalId} />
      <FormError message={state?.error} />
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Rendu le">
          <input name="returnDate" type="date" required defaultValue={today} className="input" />
        </Field>
        {hasEquipment && (
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" name="needsService" defaultChecked className="size-4 accent-brand-700" />
            À nettoyer / réviser avant la prochaine location
          </label>
        )}
      </div>
      <button className="btn-primary" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer le retour"}
      </button>
    </form>
  );
}

type EditableRental = {
  id: string;
  prescriber: string | null;
  prescriptionDate: string;
  startDate: string;
  plannedEndDate: string;
  supplier: string | null;
  deliveryNoteNumber: string | null;
  billingPeriod: BillingPeriod;
  deposit: string;
  notes: string | null;
};

export function EditRentalForm({ rental, readOnly }: { rental: EditableRental; readOnly: boolean }) {
  const [state, action, pending] = useActionState(updateRental, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="rentalId" value={rental.id} />
      <FormError message={state?.error} />
      {state && !state.error && <Notice>Modifications enregistrées.</Notice>}
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <Field label="Prescripteur">
          <input name="prescriber" defaultValue={rental.prescriber ?? ""} className="input" />
        </Field>
        <Field label="Date de l'ordonnance">
          <input name="prescriptionDate" type="date" defaultValue={rental.prescriptionDate} className="input" />
        </Field>
        <Field label="Début">
          <input name="startDate" type="date" defaultValue={rental.startDate} className="input" />
        </Field>
        <Field label="Fin prévue" hint="Modifiez-la pour prolonger la location.">
          <input name="plannedEndDate" type="date" defaultValue={rental.plannedEndDate} className="input" />
        </Field>
        <Field label="Fournisseur">
          <input name="supplier" defaultValue={rental.supplier ?? ""} className="input" />
        </Field>
        <Field label="N° de bon de livraison">
          <input name="deliveryNoteNumber" defaultValue={rental.deliveryNoteNumber ?? ""} className="input" />
        </Field>
        <Field label="Facturation">
          <select name="billingPeriod" defaultValue={rental.billingPeriod} className="input">
            {Object.entries(BILLING_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Caution (€)">
          <input name="deposit" inputMode="decimal" defaultValue={rental.deposit} className="input" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <textarea name="notes" rows={2} defaultValue={rental.notes ?? ""} className="input" />
          </Field>
        </div>
      </fieldset>
      {!readOnly && (
        <button className="btn-secondary" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
      )}
    </form>
  );
}
