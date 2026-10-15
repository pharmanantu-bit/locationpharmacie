"use client";

import type { BillingPeriod, RentalSource } from "@prisma/client";
import { useActionState, useState } from "react";
import { Field, FormError, Notice } from "@/components/ui";
import { BILLING_LABELS, SOURCE_LABELS } from "@/lib/rentals";
import { markReturned, startRental, updateRental, uploadPrescription } from "../actions";

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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Rendu le">
          <input name="returnDate" type="date" required defaultValue={today} className="input" />
        </Field>
        {hasEquipment && (
          <Field label="État constaté au retour">
            <input name="condition" className="input" placeholder="Bon état, pièce manquante…" />
          </Field>
        )}
        {hasEquipment && (
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" name="needsService" defaultChecked className="size-4 accent-brand-700" />
            À nettoyer / désinfecter avant la prochaine location
          </label>
        )}
      </div>
      <button className="btn-primary" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer le retour"}
      </button>
    </form>
  );
}

export function PrescriptionUploadForm({ rentalId, hasDocument }: { rentalId: string; hasDocument: boolean }) {
  const [state, action, pending] = useActionState(uploadPrescription, undefined);
  const [fileName, setFileName] = useState("");
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="rentalId" value={rentalId} />
      <FormError message={state?.error} />
      {state?.ok && <Notice>Ordonnance enregistrée.</Notice>}
      <input
        type="file"
        name="prescriptionFile"
        required
        accept="application/pdf,image/jpeg,image/png,image/webp"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
      />
      <button className="btn-secondary" disabled={pending || !fileName}>
        {pending ? "Envoi…" : hasDocument ? "Ajouter une nouvelle version" : "Joindre l'ordonnance"}
      </button>
    </form>
  );
}

type EditableRental = {
  id: string;
  source: RentalSource;
  prescriber: string | null;
  prescriptionDate: string;
  prescriptionDurationDays: string;
  prescriptionExpiresAt: string;
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
  const [source, setSource] = useState<RentalSource>(rental.source);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="rentalId" value={rental.id} />
      <FormError message={state?.error} />
      {state?.ok && <Notice>Modifications enregistrées.</Notice>}
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <Field label="Source du matériel">
          <select
            name="source"
            value={source}
            onChange={(e) => setSource(e.target.value as RentalSource)}
            className="input"
          >
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        {source === "SUPPLIER" ? (
          <>
            <Field label="Fournisseur">
              <input name="supplier" defaultValue={rental.supplier ?? ""} className="input" />
            </Field>
            <Field label="N° de bon de livraison">
              <input name="deliveryNoteNumber" defaultValue={rental.deliveryNoteNumber ?? ""} className="input" />
            </Field>
          </>
        ) : (
          <div className="hidden sm:block" />
        )}
        <Field label="Prescripteur">
          <input name="prescriber" defaultValue={rental.prescriber ?? ""} className="input" />
        </Field>
        <Field label="Date de l'ordonnance">
          <input name="prescriptionDate" type="date" defaultValue={rental.prescriptionDate} className="input" />
        </Field>
        <Field label="Durée prescrite (jours)">
          <input
            name="prescriptionDurationDays"
            type="number"
            min={1}
            defaultValue={rental.prescriptionDurationDays}
            className="input"
          />
        </Field>
        <Field label="Ordonnance valable jusqu'au">
          <input name="prescriptionExpiresAt" type="date" defaultValue={rental.prescriptionExpiresAt} className="input" />
        </Field>
        <Field label="Début">
          <input name="startDate" type="date" defaultValue={rental.startDate} className="input" />
        </Field>
        <Field label="Fin prévue" hint="Modifiez-la pour prolonger la location.">
          <input name="plannedEndDate" type="date" defaultValue={rental.plannedEndDate} className="input" />
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
        <Field label="Caution convenue (€)">
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
