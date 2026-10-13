"use client";

import type { EquipmentStatus, Ownership } from "@prisma/client";
import { useActionState, useState } from "react";
import { Field, FormError, Notice } from "@/components/ui";
import { EQUIPMENT_STATUS_LABELS } from "@/lib/rentals";
import { createEquipment, updateEquipment } from "./actions";

type Initial = {
  id: string;
  label: string;
  serialNumber: string | null;
  ownership: Ownership;
  supplier: string | null;
  status: EquipmentStatus;
  notes: string | null;
};

export function EquipmentForm({
  types,
  initial,
}: {
  types?: { id: string; name: string }[];
  initial?: Initial;
}) {
  const [state, action, pending] = useActionState(initial ? updateEquipment : createEquipment, undefined);
  const [ownership, setOwnership] = useState<Ownership>(initial?.ownership ?? "PHARMACY");

  return (
    <form action={action} className="space-y-4">
      {initial && <input type="hidden" name="equipmentId" value={initial.id} />}
      <FormError message={state?.error} />
      {state?.ok && <Notice>Modifications enregistrées.</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        {types && (
          <Field label="Type de matériel">
            <select name="typeId" required className="input" defaultValue="">
              <option value="">Choisir…</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Nom" hint="Marque et modèle, ou votre n° d'inventaire.">
          <input name="label" required defaultValue={initial?.label} className="input" placeholder="Medela Symphony #3" />
        </Field>
        <Field label="N° de série">
          <input name="serialNumber" defaultValue={initial?.serialNumber ?? ""} className="input" />
        </Field>
        <Field label="Propriétaire">
          <select
            name="ownership"
            value={ownership}
            onChange={(e) => setOwnership(e.target.value as Ownership)}
            className="input"
          >
            <option value="PHARMACY">La pharmacie</option>
            <option value="SUPPLIER">Un fournisseur (sous-location)</option>
          </select>
        </Field>
        {ownership === "SUPPLIER" && (
          <Field label="Fournisseur">
            <input name="supplier" defaultValue={initial?.supplier ?? ""} className="input" />
          </Field>
        )}
        {initial && (
          <Field
            label="État"
            hint={initial.status === "RENTED" ? "Géré par le dossier de location en cours." : undefined}
          >
            <select name="status" defaultValue={initial.status} disabled={initial.status === "RENTED"} className="input">
              {Object.entries(EQUIPMENT_STATUS_LABELS)
                .filter(([value]) => value !== "RENTED" || initial.status === "RENTED")
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <div className="sm:col-span-2">
          <Field label="Notes">
            <textarea name="notes" rows={2} defaultValue={initial?.notes ?? ""} className="input" />
          </Field>
        </div>
      </div>
      <button className="btn-primary" disabled={pending}>
        {pending ? "Enregistrement…" : initial ? "Enregistrer" : "Ajouter au parc"}
      </button>
    </form>
  );
}
