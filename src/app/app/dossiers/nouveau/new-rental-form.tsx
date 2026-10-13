"use client";

import type { BillingPeriod } from "@prisma/client";
import { useActionState, useMemo, useState } from "react";
import { Field, FormError } from "@/components/ui";
import { BILLING_LABELS } from "@/lib/rentals";
import { createRental } from "../actions";

type TypeOption = {
  id: string;
  name: string;
  billingPeriod: BillingPeriod;
  defaultDurationDays: number | null;
  depositCents: number | null;
};
type EquipmentOption = { id: string; typeId: string; label: string; serialNumber: string | null };
type PatientOption = { id: string; firstName: string; lastName: string; phone: string | null };

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

export function NewRentalForm({
  types,
  equipment,
  patients,
  initialPatientId,
}: {
  types: TypeOption[];
  equipment: EquipmentOption[];
  patients: PatientOption[];
  initialPatientId?: string;
}) {
  const [state, action, pending] = useActionState(createRental, undefined);

  const initialPatient = patients.find((p) => p.id === initialPatientId);
  const [patientMode, setPatientMode] = useState<"existing" | "new">(
    initialPatient || patients.length > 0 ? "existing" : "new",
  );
  const [patientQuery, setPatientQuery] = useState("");
  const [patientId, setPatientId] = useState(initialPatient?.id ?? "");

  const [typeId, setTypeId] = useState("");
  const type = types.find((t) => t.id === typeId);
  const [startDate, setStartDate] = useState(todayIso());
  const [plannedEndDate, setPlannedEndDate] = useState("");
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("WEEKLY");
  const [deposit, setDeposit] = useState("");
  const [initialStatus, setInitialStatus] = useState("ACTIVE");

  const matchingPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return patients.slice(0, 8);
    return patients
      .filter((p) => `${p.lastName} ${p.firstName} ${p.phone ?? ""}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [patients, patientQuery]);
  const selectedPatient = patients.find((p) => p.id === patientId);
  const availableEquipment = equipment.filter((e) => e.typeId === typeId);

  function onTypeChange(id: string) {
    setTypeId(id);
    const t = types.find((x) => x.id === id);
    if (!t) return;
    setBillingPeriod(t.billingPeriod);
    setDeposit(t.depositCents != null ? String(t.depositCents / 100) : "");
    if (t.defaultDurationDays && startDate) setPlannedEndDate(addDaysIso(startDate, t.defaultDurationDays));
  }

  function onStartChange(value: string) {
    setStartDate(value);
    if (type?.defaultDurationDays && value) setPlannedEndDate(addDaysIso(value, type.defaultDurationDays));
  }

  return (
    <form action={action} className="space-y-6">
      <FormError message={state?.error} />

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Patient</h2>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-sm">
            {(["existing", "new"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPatientMode(mode)}
                className={`rounded-md px-3 py-1 font-medium ${
                  patientMode === mode ? "bg-brand-50 text-brand-800" : "text-slate-500"
                }`}
              >
                {mode === "existing" ? "Patient existant" : "Nouveau patient"}
              </button>
            ))}
          </div>
        </div>

        {patientMode === "existing" ? (
          <div>
            <input type="hidden" name="patientId" value={patientId} />
            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-lg border border-brand-100 bg-brand-50 px-3 py-2">
                <span className="text-sm font-medium text-brand-900">
                  {selectedPatient.lastName.toUpperCase()} {selectedPatient.firstName}
                  {selectedPatient.phone && <span className="font-normal text-brand-800"> · {selectedPatient.phone}</span>}
                </span>
                <button type="button" onClick={() => setPatientId("")} className="text-sm text-brand-800 underline">
                  Changer
                </button>
              </div>
            ) : (
              <>
                <input
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  placeholder="Rechercher par nom ou téléphone…"
                  className="input"
                  aria-label="Rechercher un patient"
                />
                <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {matchingPatients.length === 0 && (
                    <li className="px-3 py-2 text-sm text-slate-500">
                      Aucun patient trouvé.{" "}
                      <button type="button" className="text-brand-700 underline" onClick={() => setPatientMode("new")}>
                        Créer un nouveau patient
                      </button>
                    </li>
                  )}
                  {matchingPatients.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setPatientId(p.id)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-900">
                          {p.lastName.toUpperCase()} {p.firstName}
                        </span>
                        {p.phone && <span className="text-slate-500"> · {p.phone}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom">
              <input name="patientLastName" required className="input" />
            </Field>
            <Field label="Prénom">
              <input name="patientFirstName" required className="input" />
            </Field>
            <Field label="Téléphone mobile" hint="Pour les rappels SMS de fin de contrat.">
              <input name="patientPhone" type="tel" className="input" />
            </Field>
            <Field label="E-mail">
              <input name="patientEmail" type="email" className="input" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Adresse">
                <input name="patientAddress" className="input" />
              </Field>
            </div>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Matériel et ordonnance</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type de matériel">
            <select
              name="typeId"
              required
              value={typeId}
              onChange={(e) => onTypeChange(e.target.value)}
              className="input"
            >
              <option value="">Choisir…</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Appareil du parc"
            hint={typeId && availableEquipment.length === 0 ? "Aucun appareil disponible pour ce type." : undefined}
          >
            <select name="equipmentId" className="input" disabled={!typeId} defaultValue="">
              <option value="">Non attribué (ou loué via fournisseur)</option>
              {availableEquipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                  {e.serialNumber ? ` — n° ${e.serialNumber}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prescripteur">
            <input name="prescriber" className="input" placeholder="Dr …" />
          </Field>
          <Field label="Date de l'ordonnance">
            <input name="prescriptionDate" type="date" className="input" />
          </Field>
          <Field label="Fournisseur">
            <input name="supplier" className="input" placeholder="Si le matériel est loué à un fournisseur" />
          </Field>
          <Field label="N° de bon de livraison" hint="Sert au contrôle des factures fournisseurs.">
            <input name="deliveryNoteNumber" className="input" />
          </Field>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Durée et facturation</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Statut">
            <select
              name="initialStatus"
              value={initialStatus}
              onChange={(e) => setInitialStatus(e.target.value)}
              className="input"
            >
              <option value="ACTIVE">Remis au patient</option>
              <option value="ORDERED">Commandé</option>
              <option value="DRAFT">En création</option>
            </select>
          </Field>
          <Field label="Début">
            <input
              name="startDate"
              type="date"
              value={startDate}
              onChange={(e) => onStartChange(e.target.value)}
              required={initialStatus === "ACTIVE"}
              className="input"
            />
          </Field>
          <Field label="Fin prévue">
            <input
              name="plannedEndDate"
              type="date"
              value={plannedEndDate}
              onChange={(e) => setPlannedEndDate(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Facturation">
            <select
              name="billingPeriod"
              value={billingPeriod}
              onChange={(e) => setBillingPeriod(e.target.value as BillingPeriod)}
              className="input"
            >
              {Object.entries(BILLING_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Caution (€)">
            <input
              name="deposit"
              inputMode="decimal"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              className="input"
            />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Notes">
              <input name="notes" className="input" />
            </Field>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Création…" : "Créer le dossier"}
        </button>
      </div>
    </form>
  );
}
