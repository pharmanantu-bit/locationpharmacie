import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { addDays, daysBetween, formatDateTime, formatDay, formatEuros, toInputDate, todayUTC } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  BILLING_LABELS,
  billedUntilAfter,
  isBillingDue,
  isLate,
  JOURNEY_STEPS,
  nextBillingDate,
  prescriptionState,
  SOURCE_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
} from "@/lib/rentals";
import { addNote, cancelRental, closeRental, generateContract, markBilled, markOrdered } from "../actions";
import { EditRentalForm, PrescriptionUploadForm, ReturnForm, StartForm } from "./rental-forms";

export const metadata: Metadata = { title: "Dossier" };

const PRESCRIPTION_BADGES = {
  expired: { label: "Ordonnance expirée", tone: "bg-red-50 text-red-700 ring-red-200" },
  expiring: { label: "Ordonnance expire bientôt", tone: "bg-amber-50 text-amber-800 ring-amber-200" },
} as const;

export default async function RentalPage({ params }: PageProps<"/app/dossiers/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const rental = await db.rental.findFirst({
    where: { id, pharmacyId: user.pharmacyId },
    include: {
      patient: true,
      type: true,
      equipment: true,
      documents: { orderBy: { createdAt: "desc" } },
      deposit: true,
      events: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!rental) notFound();

  const today = todayUTC();
  const late = isLate(rental, today);
  const billingDue = isBillingDue(rental, today);
  const nextBilling = nextBillingDate(rental);
  const billUntil = billedUntilAfter(rental);
  const prescription = prescriptionState(rental, today);
  const prescriptions = rental.documents.filter((d) => d.kind === "PRESCRIPTION");
  const contracts = rental.documents.filter((d) => d.kind === "CONTRACT");
  const closed = rental.status === "CLOSED" || rental.status === "CANCELLED";
  // Le dossier a changé depuis le dernier contrat : proposer de le régénérer
  const contractOutdated = contracts.length > 0 && rental.updatedAt > contracts[0].createdAt;

  const availableEquipment =
    rental.status === "DRAFT" || rental.status === "ORDERED"
      ? await db.equipment.findMany({
          where: { pharmacyId: user.pharmacyId, typeId: rental.typeId, status: "AVAILABLE" },
          orderBy: { label: "asc" },
          select: { id: true, label: true, serialNumber: true },
        })
      : [];

  // État des 6 étapes du parcours
  type StepState = { state: "done" | "todo" | "soon" | "warn"; detail: string };
  const journey: Record<(typeof JOURNEY_STEPS)[number]["key"], StepState> = {
    patient: { state: "done", detail: `${rental.patient.lastName.toUpperCase()} ${rental.patient.firstName} · ${rental.type.name}` },
    source: {
      state: rental.source === "PHARMACY_STOCK" && !rental.equipment && !closed ? "todo" : "done",
      detail:
        rental.source === "PHARMACY_STOCK"
          ? rental.equipment
            ? `Parc — ${rental.equipment.label}`
            : "Parc — appareil à attribuer"
          : `Fournisseur${rental.supplier ? ` — ${rental.supplier}` : ""}`,
    },
    prescription: {
      state:
        prescriptions.length === 0
          ? closed
            ? "done"
            : "todo"
          : prescription === "expired" || prescription === "expiring"
            ? "warn"
            : "done",
      detail:
        prescriptions.length === 0
          ? "Aucun fichier joint"
          : `Jointe · valable jusqu'au ${formatDay(rental.prescriptionExpiresAt)}`,
    },
    deposit: {
      state: "soon",
      detail: rental.depositCents
        ? `${formatEuros(rental.depositCents)} convenus · empreinte bancaire bientôt disponible`
        : "Montant à définir · empreinte bancaire bientôt disponible",
    },
    contract: {
      state: contracts.length > 0 ? (contractOutdated ? "warn" : "done") : closed ? "done" : "todo",
      detail:
        contracts.length > 0
          ? contractOutdated
            ? `Généré le ${formatDay(contracts[0].createdAt)} · dossier modifié depuis`
            : `Généré le ${formatDay(contracts[0].createdAt)} · à faire signer`
          : "À générer puis à faire signer au patient",
    },
    followup: {
      state: "soon",
      detail: rental.patient.smsConsent ? "Consentement SMS recueilli · rappels bientôt disponibles" : "Pas de consentement SMS",
    },
  };

  return (
    <>
      <div className="mb-6">
        <Link href="/app/dossiers" className="text-sm text-slate-500 hover:text-slate-900">
          ← Dossiers
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{rental.number}</h1>
          <Badge tone={STATUS_TONES[rental.status]}>{STATUS_LABELS[rental.status]}</Badge>
          {late && <Badge tone="bg-red-50 text-red-700 ring-red-200">En retard</Badge>}
          {billingDue && <Badge tone="bg-violet-50 text-violet-700 ring-violet-200">À facturer</Badge>}
          {(prescription === "expired" || prescription === "expiring") && (
            <Badge tone={PRESCRIPTION_BADGES[prescription].tone}>{PRESCRIPTION_BADGES[prescription].label}</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {rental.type.name} pour{" "}
          <Link href={`/app/patients/${rental.patient.id}`} className="font-medium text-slate-700 hover:underline">
            {rental.patient.lastName.toUpperCase()} {rental.patient.firstName}
          </Link>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Parcours en 6 étapes */}
          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Parcours du dossier</h2>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {JOURNEY_STEPS.map((s, i) => {
                const j = journey[s.key];
                const styles = {
                  done: "border-emerald-200 bg-emerald-50/50",
                  todo: "border-amber-300 bg-amber-50",
                  warn: "border-red-200 bg-red-50",
                  soon: "border-slate-200 bg-slate-50 text-slate-500",
                }[j.state];
                const mark = { done: "✓", todo: "!", warn: "!", soon: "…" }[j.state];
                return (
                  <li key={s.key} className={`rounded-lg border p-3 text-sm ${styles}`}>
                    <p className="font-medium">
                      <span className="mr-1 inline-block w-4 text-center">{mark}</span>
                      {i + 1}. {s.label}
                    </p>
                    <p className="mt-0.5 pl-5 text-xs text-slate-600">{j.detail}</p>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Prochaine étape selon le statut */}
          {(rental.status === "DRAFT" || rental.status === "ORDERED") && (
            <section className="card p-5">
              <h2 className="font-semibold text-slate-900">Remettre le matériel au patient</h2>
              <p className="mt-1 mb-4 text-sm text-slate-500">
                Attribuez un appareil du parc (facultatif si le matériel vient d&apos;un fournisseur) et fixez les dates.
              </p>
              <StartForm
                rentalId={rental.id}
                equipment={availableEquipment}
                startDate={toInputDate(rental.startDate ?? today)}
                plannedEndDate={toInputDate(
                  rental.plannedEndDate ??
                    (rental.prescriptionDurationDays
                      ? addDays(today, rental.prescriptionDurationDays)
                      : rental.type.defaultDurationDays
                        ? addDays(today, rental.type.defaultDurationDays)
                        : null),
                )}
              />
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {rental.status === "DRAFT" && (
                  <form action={markOrdered}>
                    <input type="hidden" name="rentalId" value={rental.id} />
                    <SubmitButton className="btn-secondary">Marquer comme commandé</SubmitButton>
                  </form>
                )}
                <form action={cancelRental}>
                  <input type="hidden" name="rentalId" value={rental.id} />
                  <SubmitButton className="btn-danger" confirm="Annuler ce dossier ?">
                    Annuler le dossier
                  </SubmitButton>
                </form>
              </div>
            </section>
          )}

          {rental.status === "ACTIVE" && (
            <section className="card p-5">
              <h2 className="font-semibold text-slate-900">Retour du matériel</h2>
              <p className="mt-1 mb-4 text-sm text-slate-500">
                {rental.plannedEndDate
                  ? late
                    ? `Fin prévue le ${formatDay(rental.plannedEndDate)}, dépassée de ${daysBetween(rental.plannedEndDate, today)} jour(s).`
                    : `Fin prévue le ${formatDay(rental.plannedEndDate)}.`
                  : "Pas de fin prévue. Pour prolonger, modifiez la fin prévue ci-dessous."}
              </p>
              <ReturnForm rentalId={rental.id} today={toInputDate(today)} hasEquipment={!!rental.equipmentId} />
            </section>
          )}

          {rental.status === "TO_CLOSE" && (
            <section className="card p-5">
              <h2 className="font-semibold text-slate-900">Clôturer le dossier</h2>
              <p className="mt-1 mb-4 text-sm text-slate-500">
                Matériel rendu le {formatDay(rental.returnDate)}.{" "}
                {billingDue
                  ? "Une période reste à facturer dans le LGO avant de clôturer."
                  : "Toutes les périodes sont facturées."}
              </p>
              <form action={closeRental}>
                <input type="hidden" name="rentalId" value={rental.id} />
                <SubmitButton
                  className="btn-primary"
                  confirm={billingDue ? "Une période n'est pas marquée facturée. Clôturer quand même ?" : undefined}
                >
                  Clôturer le dossier
                </SubmitButton>
              </form>
            </section>
          )}

          {/* Ordonnance */}
          <section className="card p-5">
            <h2 className="mb-1 font-semibold text-slate-900">Ordonnance</h2>
            <p className="mb-4 text-sm text-slate-500">
              {rental.prescriber ? `${rental.prescriber} · ` : ""}
              {rental.prescriptionDate ? `du ${formatDay(rental.prescriptionDate)}` : "date non renseignée"}
              {rental.prescriptionDurationDays ? ` · ${rental.prescriptionDurationDays} jours` : ""}
              {rental.prescriptionExpiresAt ? ` · valable jusqu'au ${formatDay(rental.prescriptionExpiresAt)}` : ""}
            </p>
            {prescriptions.length > 0 ? (
              <ul className="mb-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {prescriptions.map((d, i) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div>
                      <a
                        href={`/app/documents/${d.id}`}
                        target="_blank"
                        rel="noopener"
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {d.fileName}
                      </a>
                      <span className="block text-xs text-slate-500">
                        {formatDateTime(d.createdAt)} · {Math.max(1, Math.round(d.sizeBytes / 1024))} Ko
                        {i > 0 && " · version précédente"}
                      </span>
                    </div>
                    {i === 0 && <Badge tone="bg-emerald-50 text-emerald-800 ring-emerald-200">Actuelle</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              !closed && (
                <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Aucune ordonnance jointe. Ajoutez le PDF ou une photo pour conserver le justificatif avec le dossier.
                </p>
              )
            )}
            {!closed && <PrescriptionUploadForm rentalId={rental.id} hasDocument={prescriptions.length > 0} />}
          </section>

          {/* Contrat (étape 5) */}
          {rental.status !== "CANCELLED" && (
            <section className="card p-5">
              <h2 className="mb-1 font-semibold text-slate-900">Contrat de location</h2>
              <p className="mb-4 text-sm text-slate-500">
                PDF pré-rempli avec les informations de la pharmacie, du patient, du matériel et de l&apos;ordonnance.
                À imprimer en deux exemplaires et faire signer au patient.
              </p>
              {contracts.length > 0 ? (
                <ul className="mb-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {contracts.map((d, i) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div>
                        <a
                          href={`/app/documents/${d.id}`}
                          target="_blank"
                          rel="noopener"
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {d.fileName}
                        </a>
                        <span className="block text-xs text-slate-500">
                          {formatDateTime(d.createdAt)}
                          {i > 0 && " · version précédente"}
                        </span>
                      </div>
                      {i === 0 && <Badge tone="bg-emerald-50 text-emerald-800 ring-emerald-200">Actuel</Badge>}
                    </li>
                  ))}
                </ul>
              ) : (
                !closed && (
                  <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Aucun contrat généré.
                    {(rental.status === "DRAFT" || rental.status === "ORDERED") &&
                      " Attribuez l'appareil et fixez les dates avant de le générer : ils seront repris sur le contrat."}
                  </p>
                )
              )}
              {contractOutdated && !closed && (
                <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Le dossier a été modifié depuis la génération du contrat. Régénérez-le si les informations reprises
                  ont changé.
                </p>
              )}
              {!closed && (
                <form action={generateContract}>
                  <input type="hidden" name="rentalId" value={rental.id} />
                  <SubmitButton
                    className={contracts.length > 0 ? "btn-secondary" : "btn-primary"}
                    pendingLabel="Génération…"
                  >
                    {contracts.length > 0 ? "Régénérer le contrat" : "Générer le contrat"}
                  </SubmitButton>
                </form>
              )}
            </section>
          )}

          <section className="card p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Informations du dossier</h2>
            <EditRentalForm
              rental={{
                id: rental.id,
                source: rental.source,
                prescriber: rental.prescriber,
                prescriptionDate: toInputDate(rental.prescriptionDate),
                prescriptionDurationDays: rental.prescriptionDurationDays?.toString() ?? "",
                prescriptionExpiresAt: toInputDate(rental.prescriptionExpiresAt),
                startDate: toInputDate(rental.startDate),
                plannedEndDate: toInputDate(rental.plannedEndDate),
                supplier: rental.supplier,
                deliveryNoteNumber: rental.deliveryNoteNumber,
                billingPeriod: rental.billingPeriod,
                price: rental.priceCents != null ? String(rental.priceCents / 100) : "",
                deposit: rental.depositCents != null ? String(rental.depositCents / 100) : "",
                notes: rental.notes,
              }}
              readOnly={closed}
            />
          </section>

          <section className="card p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Historique</h2>
            <form action={addNote} className="mb-5 flex gap-2">
              <input type="hidden" name="rentalId" value={rental.id} />
              <input name="note" placeholder="Ajouter une note (appel patient, relance…)" className="input" required />
              <SubmitButton className="btn-secondary" pendingLabel="…">
                Ajouter
              </SubmitButton>
            </form>
            <ol className="space-y-3">
              {rental.events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-slate-300" />
                  <div>
                    <p className="text-slate-800">{e.message}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(e.createdAt)}
                      {e.user && ` · ${e.user.name}`}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5 text-sm">
            <h2 className="mb-3 font-semibold text-slate-900">Patient</h2>
            <p className="font-medium text-slate-900">
              {rental.patient.lastName.toUpperCase()} {rental.patient.firstName}
            </p>
            <p className="text-slate-600">{rental.patient.phone ?? "Pas de téléphone"}</p>
            {rental.patient.email && <p className="text-slate-600">{rental.patient.email}</p>}
            {rental.patient.address && <p className="text-slate-600">{rental.patient.address}</p>}
            <p className="mt-2 text-xs text-slate-500">
              {rental.patient.smsConsent ? "Accepte les SMS de suivi" : "Pas de consentement SMS"}
            </p>
          </section>

          <section className="card p-5 text-sm">
            <h2 className="mb-3 font-semibold text-slate-900">Matériel</h2>
            <p className="font-medium text-slate-900">{rental.type.name}</p>
            <p className="text-xs text-slate-500">{SOURCE_LABELS[rental.source]}</p>
            {rental.equipment ? (
              <Link href={`/app/parc/${rental.equipment.id}`} className="text-brand-700 hover:underline">
                {rental.equipment.label}
                {rental.equipment.serialNumber && ` — n° ${rental.equipment.serialNumber}`}
              </Link>
            ) : (
              <p className="text-slate-500">Aucun appareil du parc attribué</p>
            )}
            {rental.source === "SUPPLIER" && (
              <p className="text-slate-600">
                {rental.supplier ?? "Fournisseur non renseigné"}
                {rental.deliveryNoteNumber && ` · BL ${rental.deliveryNoteNumber}`}
              </p>
            )}
            <dl className="mt-3 space-y-1 text-slate-600">
              <Row label="Début" value={formatDay(rental.startDate)} />
              <Row label="Fin prévue" value={formatDay(rental.plannedEndDate)} />
              {rental.returnDate && <Row label="Rendu le" value={formatDay(rental.returnDate)} />}
              <Row label="Caution" value={formatEuros(rental.depositCents)} />
            </dl>
          </section>

          <section className="card p-5 text-sm">
            <h2 className="mb-3 font-semibold text-slate-900">Facturation LGO</h2>
            <dl className="space-y-1 text-slate-600">
              <Row label="Périodicité" value={BILLING_LABELS[rental.billingPeriod]} />
              <Row label="Tarif" value={formatEuros(rental.priceCents)} />
              <Row
                label="Facturé jusqu'au"
                value={
                  rental.billedUntil
                    ? rental.billingPeriod === "ONE_OFF"
                      ? "Forfait facturé"
                      : formatDay(addDays(rental.billedUntil, -1))
                    : "Rien de facturé"
                }
              />
            </dl>
            {billingDue && nextBilling && billUntil && (
              <form action={markBilled} className="mt-4">
                <input type="hidden" name="rentalId" value={rental.id} />
                <p className="mb-2 text-violet-700">
                  {rental.billingPeriod === "ONE_OFF"
                    ? "Le forfait est à facturer."
                    : `À facturer : du ${formatDay(nextBilling)} au ${formatDay(addDays(billUntil, -1))}.`}
                </p>
                <SubmitButton className="btn-secondary w-full">J&apos;ai facturé dans le LGO</SubmitButton>
              </form>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
