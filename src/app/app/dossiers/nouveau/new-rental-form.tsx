"use client";

import type { BillingPeriod, RentalSource } from "@prisma/client";
import { useActionState, useMemo, useState } from "react";
import { Field, FormError } from "@/components/ui";
import { BILLING_LABELS, JOURNEY_STEPS } from "@/lib/rentals";
import { createRental } from "../actions";

type TypeOption = {
  id: string;
  name: string;
  billingPeriod: BillingPeriod;
  defaultDurationDays: number | null;
  depositCents: number | null;
};
type EquipmentOption = { id: string; typeId: string; label: string; serialNumber: string | null };
type PatientOption = { id: string; firstName: string; lastName: string; phone: string | null; smsConsent: boolean };

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

function formatIso(iso: string) {
  return iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "—";
}

// Étapes 1 à 3 sont saisies ici, dans un seul formulaire ; les étapes 4 à 6
// (caution, contrat, suivi) se font ensuite sur la fiche du dossier.
const LAST_INPUT_STEP = 3;
const RECAP_STEP = 4;

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
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);

  // Étape 1 : patient et matériel
  const initialPatient = patients.find((p) => p.id === initialPatientId);
  const [patientMode, setPatientMode] = useState<"existing" | "new">(
    initialPatient || patients.length > 0 ? "existing" : "new",
  );
  const [patientQuery, setPatientQuery] = useState("");
  const [patientId, setPatientId] = useState(initialPatient?.id ?? "");
  const [newPatient, setNewPatient] = useState({ lastName: "", firstName: "", phone: "", email: "", address: "" });
  const [smsConsent, setSmsConsent] = useState(false);
  const [typeId, setTypeId] = useState("");
  const type = types.find((t) => t.id === typeId);

  // Étape 2 : source
  const [source, setSource] = useState<RentalSource>("PHARMACY_STOCK");
  const [equipmentId, setEquipmentId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState("");
  const [handedNow, setHandedNow] = useState(true);

  // Étape 3 : ordonnance et durée
  const [fileName, setFileName] = useState("");
  const [prescriber, setPrescriber] = useState("");
  const [prescriptionDate, setPrescriptionDate] = useState(todayIso());
  const [duration, setDuration] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [plannedEndDate, setPlannedEndDate] = useState("");
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("WEEKLY");
  const [deposit, setDeposit] = useState("");

  const matchingPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return patients.slice(0, 8);
    return patients
      .filter((p) => `${p.lastName} ${p.firstName} ${p.phone ?? ""}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [patients, patientQuery]);
  const selectedPatient = patients.find((p) => p.id === patientId);
  const availableEquipment = equipment.filter((e) => e.typeId === typeId);
  const selectedEquipment = equipment.find((e) => e.id === equipmentId);
  const initialStatus = handedNow ? "ACTIVE" : source === "SUPPLIER" ? "ORDERED" : "DRAFT";

  function recomputeDates(nextDuration: string, nextPrescriptionDate: string, nextStart: string) {
    const days = Number(nextDuration);
    if (Number.isInteger(days) && days > 0) {
      if (nextPrescriptionDate) setExpiresAt(addDaysIso(nextPrescriptionDate, days));
      if (nextStart) setPlannedEndDate(addDaysIso(nextStart, days));
    }
  }

  function onTypeChange(id: string) {
    setTypeId(id);
    setEquipmentId("");
    const t = types.find((x) => x.id === id);
    if (!t) return;
    setBillingPeriod(t.billingPeriod);
    setDeposit(t.depositCents != null ? String(t.depositCents / 100) : "");
    const d = t.defaultDurationDays ? String(t.defaultDurationDays) : "";
    setDuration(d);
    recomputeDates(d, prescriptionDate, startDate);
  }

  function validate(s: number): string | null {
    if (s === 1) {
      if (patientMode === "existing" && !patientId) return "Choisissez un patient ou créez-en un nouveau.";
      if (patientMode === "new" && (!newPatient.lastName.trim() || !newPatient.firstName.trim())) {
        return "Indiquez le nom et le prénom du patient.";
      }
      if (!typeId) return "Choisissez le type de matériel.";
    }
    if (s === 2) {
      if (source === "PHARMACY_STOCK" && handedNow && availableEquipment.length > 0 && !equipmentId) {
        return "Choisissez l'appareil remis au patient, ou indiquez qu'il sera attribué plus tard.";
      }
    }
    if (s === 3) {
      if (handedNow && !startDate) return "Indiquez la date de remise au patient.";
      if (startDate && plannedEndDate && plannedEndDate < startDate) return "La fin prévue est antérieure au début.";
    }
    return null;
  }

  function next() {
    const err = validate(step);
    setStepError(err);
    if (!err) setStep(step + 1);
  }

  function goTo(s: number) {
    if (s < step) {
      setStepError(null);
      setStep(s);
    }
  }

  const stepClass = (s: number) => (step === s ? "card p-5" : "hidden");

  return (
    <form action={action} noValidate className="space-y-6">
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {JOURNEY_STEPS.map((s, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          const later = n > LAST_INPUT_STEP;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => goTo(n)}
                disabled={later || n >= step}
                className={`w-full rounded-lg border px-2 py-2 text-left text-xs transition ${
                  current
                    ? "border-brand-600 bg-brand-50 text-brand-900"
                    : done
                      ? "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      : "border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                <span className="block font-semibold">
                  {done ? "✓ " : ""}Étape {n}
                </span>
                <span className="block">{s.label}</span>
                {later && <span className="block text-[11px]">après création</span>}
              </button>
            </li>
          );
        })}
      </ol>

      <FormError message={stepError ?? state?.error} />

      {/* Étape 1 — Patient et matériel */}
      <section className={stepClass(1)}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">1. Patient et matériel</h2>
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
              <input
                name="patientLastName"
                value={newPatient.lastName}
                onChange={(e) => setNewPatient({ ...newPatient, lastName: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Prénom">
              <input
                name="patientFirstName"
                value={newPatient.firstName}
                onChange={(e) => setNewPatient({ ...newPatient, firstName: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Téléphone mobile" hint="Pour le lien de caution et les rappels SMS.">
              <input
                name="patientPhone"
                type="tel"
                value={newPatient.phone}
                onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="E-mail">
              <input
                name="patientEmail"
                type="email"
                value={newPatient.email}
                onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                className="input"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Adresse">
                <input
                  name="patientAddress"
                  value={newPatient.address}
                  onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
          </div>
        )}

        {(patientMode === "new" || (selectedPatient && !selectedPatient.smsConsent)) && (
          <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="smsConsent"
              checked={smsConsent}
              onChange={(e) => setSmsConsent(e.target.checked)}
              className="mt-0.5 size-4 accent-brand-700"
            />
            <span>
              Le patient accepte de recevoir des SMS liés à sa location (matériel prêt, fin de contrat, retour).
              <span className="block text-xs text-slate-500">Aucun message commercial. Consentement tracé (RGPD).</span>
            </span>
          </label>
        )}

        <div className="mt-5 border-t border-slate-100 pt-5">
          <Field label="Matériel loué">
            <select name="typeId" value={typeId} onChange={(e) => onTypeChange(e.target.value)} className="input">
              <option value="">Choisir le type de matériel…</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* Étape 2 — Source du matériel */}
      <section className={stepClass(2)}>
        <h2 className="mb-4 font-semibold text-slate-900">2. D&apos;où vient le matériel ?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["PHARMACY_STOCK", "Parc de la pharmacie", "Un appareil que vous possédez ou sous-louez déjà."],
              ["SUPPLIER", "Commande fournisseur", "Matériel commandé pour ce patient (lit, fauteuil…)."],
            ] as const
          ).map(([value, title, desc]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-lg border p-4 ${
                source === value ? "border-brand-600 bg-brand-50" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="source"
                value={value}
                checked={source === value}
                onChange={() => {
                  setSource(value);
                  setHandedNow(value === "PHARMACY_STOCK");
                }}
                className="sr-only"
              />
              <span className="block font-medium text-slate-900">{title}</span>
              <span className="block text-sm text-slate-500">{desc}</span>
            </label>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {source === "PHARMACY_STOCK" ? (
            <Field
              label="Appareil du parc"
              hint={
                typeId && availableEquipment.length === 0
                  ? "Aucun appareil disponible pour ce type : il pourra être attribué plus tard."
                  : "Le n° de série sera repris sur le contrat."
              }
            >
              <select
                name="equipmentId"
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                className="input"
                disabled={!typeId}
              >
                <option value="">Attribuer plus tard</option>
                {availableEquipment.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                    {e.serialNumber ? ` — n° ${e.serialNumber}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <>
              <Field label="Fournisseur">
                <input
                  name="supplier"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="input"
                  placeholder="Ex. Bastide, Harmonie Médical…"
                />
              </Field>
              <Field label="N° de bon de livraison" hint="Servira au contrôle des factures fournisseurs.">
                <input
                  name="deliveryNoteNumber"
                  value={deliveryNoteNumber}
                  onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                  className="input"
                />
              </Field>
            </>
          )}
          <Field label="Situation">
            <input type="hidden" name="initialStatus" value={initialStatus} />
            <select
              value={handedNow ? "now" : "later"}
              onChange={(e) => setHandedNow(e.target.value === "now")}
              className="input"
            >
              <option value="now">Le patient repart avec le matériel</option>
              <option value="later">
                {source === "SUPPLIER" ? "Commandé, en attente de livraison" : "À préparer, remise plus tard"}
              </option>
            </select>
          </Field>
        </div>
      </section>

      {/* Étape 3 — Ordonnance et durée */}
      <section className={stepClass(3)}>
        <h2 className="mb-4 font-semibold text-slate-900">3. Ordonnance et durée de location</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Ordonnance (PDF ou photo)" hint="8 Mo max. Conservée de façon sécurisée avec le dossier.">
              <input
                type="file"
                name="prescriptionFile"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
                className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
              />
            </Field>
          </div>
          <Field label="Prescripteur">
            <input
              name="prescriber"
              value={prescriber}
              onChange={(e) => setPrescriber(e.target.value)}
              className="input"
              placeholder="Dr …"
            />
          </Field>
          <Field label="Date de l'ordonnance">
            <input
              name="prescriptionDate"
              type="date"
              value={prescriptionDate}
              onChange={(e) => {
                setPrescriptionDate(e.target.value);
                recomputeDates(duration, e.target.value, startDate);
              }}
              className="input"
            />
          </Field>
          <Field label="Durée prescrite (jours)" hint="Pré-remplie depuis le type de matériel.">
            <input
              name="prescriptionDurationDays"
              type="number"
              min={1}
              value={duration}
              onChange={(e) => {
                setDuration(e.target.value);
                recomputeDates(e.target.value, prescriptionDate, startDate);
              }}
              className="input"
            />
          </Field>
          <Field label="Ordonnance valable jusqu'au" hint="Un rappel sera envoyé avant cette date (phase SMS).">
            <input
              name="prescriptionExpiresAt"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="input"
            />
          </Field>
          <Field label={handedNow ? "Remis le" : "Début prévu"}>
            <input
              name="startDate"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                recomputeDates(duration, prescriptionDate, e.target.value);
              }}
              className="input"
            />
          </Field>
          <Field label="Fin prévue" hint="Début + durée prescrite, modifiable.">
            <input
              name="plannedEndDate"
              type="date"
              value={plannedEndDate}
              onChange={(e) => setPlannedEndDate(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Facturation LGO">
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
          <Field label="Caution convenue (€)" hint="Empreinte bancaire demandée au patient à l'étape 4.">
            <input
              name="deposit"
              inputMode="decimal"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              className="input"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <input name="notes" className="input" />
            </Field>
          </div>
        </div>
      </section>

      {/* Récapitulatif */}
      <section className={stepClass(RECAP_STEP)}>
        <h2 className="mb-4 font-semibold text-slate-900">Récapitulatif</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row
            label="Patient"
            value={
              patientMode === "existing" && selectedPatient
                ? `${selectedPatient.lastName.toUpperCase()} ${selectedPatient.firstName}`
                : `${newPatient.lastName.toUpperCase()} ${newPatient.firstName}`
            }
          />
          <Row label="Matériel" value={type?.name ?? "—"} />
          <Row
            label="Source"
            value={
              source === "PHARMACY_STOCK"
                ? `Parc${selectedEquipment ? ` — ${selectedEquipment.label}` : " (appareil à attribuer)"}`
                : `Fournisseur${supplier ? ` — ${supplier}` : ""}`
            }
          />
          <Row
            label="Situation"
            value={
              initialStatus === "ACTIVE"
                ? `Remis le ${formatIso(startDate)}`
                : initialStatus === "ORDERED"
                  ? "Commandé"
                  : "À préparer"
            }
          />
          <Row label="Ordonnance" value={fileName || "Aucun fichier joint (à ajouter sur le dossier)"} />
          <Row label="Valable jusqu'au" value={formatIso(expiresAt)} />
          <Row label="Fin prévue" value={formatIso(plannedEndDate)} />
          <Row label="Caution" value={deposit ? `${deposit} €` : "—"} />
        </dl>
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Après création, le dossier vous guide pour les étapes suivantes : caution par empreinte bancaire, contrat et
          rappels SMS.
        </p>
      </section>

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => goTo(step - 1)} disabled={step === 1} className="btn-secondary">
          Précédent
        </button>
        {/* Clés distinctes : sinon React réutilise le même <button> et le clic sur
            « Vérifier » déclencherait la soumission du formulaire. */}
        {step <= LAST_INPUT_STEP ? (
          <button key="next" type="button" onClick={next} className="btn-primary">
            {step === LAST_INPUT_STEP ? "Vérifier" : "Suivant"}
          </button>
        ) : (
          <button key="submit" type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Création…" : "Créer le dossier"}
          </button>
        )}
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
