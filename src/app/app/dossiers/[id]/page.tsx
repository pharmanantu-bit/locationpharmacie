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
  nextBillingDate,
  STATUS_LABELS,
  STATUS_TONES,
} from "@/lib/rentals";
import { addNote, cancelRental, closeRental, markBilled, markOrdered } from "../actions";
import { EditRentalForm, ReturnForm, StartForm } from "./rental-forms";

export const metadata: Metadata = { title: "Dossier" };

export default async function RentalPage({ params }: PageProps<"/app/dossiers/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const rental = await db.rental.findFirst({
    where: { id, pharmacyId: user.pharmacyId },
    include: {
      patient: true,
      type: true,
      equipment: true,
      events: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!rental) notFound();

  const today = todayUTC();
  const late = isLate(rental, today);
  const billingDue = isBillingDue(rental, today);
  const nextBilling = nextBillingDate(rental);
  const billUntil = billedUntilAfter(rental);

  const availableEquipment =
    rental.status === "DRAFT" || rental.status === "ORDERED"
      ? await db.equipment.findMany({
          where: { pharmacyId: user.pharmacyId, typeId: rental.typeId, status: "AVAILABLE" },
          orderBy: { label: "asc" },
          select: { id: true, label: true, serialNumber: true },
        })
      : [];

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
                    (rental.type.defaultDurationDays ? addDays(today, rental.type.defaultDurationDays) : null),
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

          <section className="card p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Informations du dossier</h2>
            <EditRentalForm
              rental={{
                id: rental.id,
                prescriber: rental.prescriber,
                prescriptionDate: toInputDate(rental.prescriptionDate),
                startDate: toInputDate(rental.startDate),
                plannedEndDate: toInputDate(rental.plannedEndDate),
                supplier: rental.supplier,
                deliveryNoteNumber: rental.deliveryNoteNumber,
                billingPeriod: rental.billingPeriod,
                deposit: rental.depositCents != null ? String(rental.depositCents / 100) : "",
                notes: rental.notes,
              }}
              readOnly={rental.status === "CLOSED" || rental.status === "CANCELLED"}
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
          </section>

          <section className="card p-5 text-sm">
            <h2 className="mb-3 font-semibold text-slate-900">Matériel</h2>
            <p className="font-medium text-slate-900">{rental.type.name}</p>
            {rental.equipment ? (
              <Link href={`/app/parc/${rental.equipment.id}`} className="text-brand-700 hover:underline">
                {rental.equipment.label}
                {rental.equipment.serialNumber && ` — n° ${rental.equipment.serialNumber}`}
              </Link>
            ) : (
              <p className="text-slate-500">Aucun appareil du parc attribué</p>
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
