import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RentalTable } from "@/components/rental-table";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDateTime, formatDay, toInputDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { EQUIPMENT_EVENT_LABELS, EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUS_TONES } from "@/lib/rentals";
import { addEquipmentNote, endMaintenance, markCleaned, sendToMaintenance } from "../actions";
import { EquipmentForm } from "../equipment-form";

export const metadata: Metadata = { title: "Appareil" };

export default async function EquipmentDetailPage({ params }: PageProps<"/app/parc/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const equipment = await db.equipment.findFirst({
    where: { id, pharmacyId: user.pharmacyId },
    include: {
      type: true,
      rentals: { include: { patient: true, type: true, equipment: true }, orderBy: { createdAt: "desc" } },
      events: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!equipment) notFound();

  const current = equipment.rentals.find((r) => r.status === "ACTIVE");
  const canService = equipment.status !== "RENTED" && equipment.status !== "RETIRED";

  return (
    <>
      <div className="mb-6">
        <Link href="/app/parc" className="text-sm text-slate-500 hover:text-slate-900">
          ← Parc
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{equipment.label}</h1>
          <Badge tone={EQUIPMENT_STATUS_TONES[equipment.status]}>{EQUIPMENT_STATUS_LABELS[equipment.status]}</Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {equipment.type.name}
          {equipment.serialNumber && ` · n° ${equipment.serialNumber}`} · {equipment.rentals.length} location
          {equipment.rentals.length > 1 ? "s" : ""}
          {equipment.lastCleanedAt && ` · dernier nettoyage le ${formatDay(equipment.lastCleanedAt)}`}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Où est l'appareil, et que faire maintenant */}
          <section className="card p-5">
            <h2 className="font-semibold text-slate-900">Localisation et entretien</h2>
            <p className="mt-1 mb-4 text-sm text-slate-600">
              {equipment.status === "RENTED" && current ? (
                <>
                  Chez{" "}
                  <Link href={`/app/dossiers/${current.id}`} className="font-medium text-brand-700 hover:underline">
                    {current.patient.lastName.toUpperCase()} {current.patient.firstName}
                  </Link>{" "}
                  depuis le {formatDay(current.startDate)} (dossier {current.number}).
                </>
              ) : equipment.status === "CLEANING" ? (
                "En pharmacie, à nettoyer et désinfecter avant la prochaine location."
              ) : equipment.status === "MAINTENANCE" ? (
                "En maintenance ou réparation."
              ) : equipment.status === "RETIRED" ? (
                "Hors service, retiré du parc."
              ) : (
                "En pharmacie, disponible pour une location."
              )}
            </p>
            {canService && (
              <div className="flex flex-wrap gap-2">
                {equipment.status !== "MAINTENANCE" && (
                  <form action={markCleaned} className="flex gap-2">
                    <input type="hidden" name="equipmentId" value={equipment.id} />
                    <input name="note" placeholder="Produit, remarque…" className="input w-44" />
                    <SubmitButton className="btn-primary" pendingLabel="…">
                      Nettoyé et désinfecté
                    </SubmitButton>
                  </form>
                )}
                {equipment.status === "MAINTENANCE" ? (
                  <form action={endMaintenance} className="flex gap-2">
                    <input type="hidden" name="equipmentId" value={equipment.id} />
                    <input name="note" placeholder="Réparation effectuée…" className="input w-44" />
                    <SubmitButton className="btn-primary" pendingLabel="…">
                      Remettre en service
                    </SubmitButton>
                  </form>
                ) : (
                  <form action={sendToMaintenance} className="flex gap-2">
                    <input type="hidden" name="equipmentId" value={equipment.id} />
                    <input name="note" placeholder="Motif…" className="input w-44" />
                    <SubmitButton className="btn-secondary" pendingLabel="…">
                      Envoyer en maintenance
                    </SubmitButton>
                  </form>
                )}
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Fiche de l&apos;appareil</h2>
            <EquipmentForm
              initial={{
                id: equipment.id,
                label: equipment.label,
                serialNumber: equipment.serialNumber,
                ownership: equipment.ownership,
                supplier: equipment.supplier,
                status: equipment.status,
                purchaseDate: toInputDate(equipment.purchaseDate),
                condition: equipment.condition,
                notes: equipment.notes,
              }}
            />
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Historique des locations</h2>
            {equipment.rentals.length === 0 ? (
              <p className="text-sm text-slate-500">Cet appareil n&apos;a pas encore été loué.</p>
            ) : (
              <RentalTable rentals={equipment.rentals} />
            )}
          </section>
        </div>

        <aside>
          <section className="card p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Historique de vie</h2>
            <form action={addEquipmentNote} className="mb-4 flex gap-2">
              <input type="hidden" name="equipmentId" value={equipment.id} />
              <input name="note" placeholder="Ajouter une note…" className="input" required />
              <SubmitButton className="btn-secondary" pendingLabel="…">
                OK
              </SubmitButton>
            </form>
            {equipment.events.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun événement enregistré.</p>
            ) : (
              <ol className="space-y-3">
                {equipment.events.map((e) => (
                  <li key={e.id} className="flex gap-3 text-sm">
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        e.kind === "CLEANED"
                          ? "bg-emerald-500"
                          : e.kind === "RENTED" || e.kind === "RETURNED"
                            ? "bg-sky-500"
                            : e.kind.startsWith("MAINTENANCE")
                              ? "bg-orange-500"
                              : "bg-slate-300"
                      }`}
                    />
                    <div>
                      <p className="font-medium text-slate-800">{EQUIPMENT_EVENT_LABELS[e.kind]}</p>
                      <p className="text-slate-600">{e.message}</p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(e.createdAt)}
                        {e.user && ` · ${e.user.name}`}
                        {e.rentalId && (
                          <>
                            {" · "}
                            <Link href={`/app/dossiers/${e.rentalId}`} className="hover:underline">
                              dossier
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
