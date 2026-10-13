"use client";

import { useActionState } from "react";
import { Field, FormError, Notice } from "@/components/ui";
import { updatePatient } from "../actions";

type PatientValues = {
  id: string;
  lastName: string;
  firstName: string;
  phone: string;
  email: string;
  address: string;
  birthDate: string;
  notes: string;
};

export function PatientForm({ patient }: { patient: PatientValues }) {
  const [state, action, pending] = useActionState(updatePatient, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="patientId" value={patient.id} />
      <FormError message={state?.error} />
      {state?.ok && <Notice>Modifications enregistrées.</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom">
          <input name="lastName" required defaultValue={patient.lastName} className="input" />
        </Field>
        <Field label="Prénom">
          <input name="firstName" required defaultValue={patient.firstName} className="input" />
        </Field>
        <Field label="Téléphone mobile">
          <input name="phone" type="tel" defaultValue={patient.phone} className="input" />
        </Field>
        <Field label="E-mail">
          <input name="email" type="email" defaultValue={patient.email} className="input" />
        </Field>
        <Field label="Adresse">
          <input name="address" defaultValue={patient.address} className="input" />
        </Field>
        <Field label="Date de naissance">
          <input name="birthDate" type="date" defaultValue={patient.birthDate} className="input" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <textarea name="notes" rows={2} defaultValue={patient.notes} className="input" />
          </Field>
        </div>
      </div>
      <button className="btn-secondary" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
