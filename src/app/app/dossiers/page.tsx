import type { Prisma, RentalStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { RentalTable } from "@/components/rental-table";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { addDays, todayUTC } from "@/lib/dates";
import { db } from "@/lib/db";
import { isBillingDue, isLate, OPEN_STATUSES, STATUS_LABELS } from "@/lib/rentals";

export const metadata: Metadata = { title: "Dossiers" };

const FILTERS = {
  retard: "En retard",
  "fin-proche": "Fin sous 7 jours",
  "a-facturer": "À facturer",
} as const;

export default async function RentalsPage({ searchParams }: PageProps<"/app/dossiers">) {
  const user = await requireUser();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const statut = one(params.statut);
  const type = one(params.type);
  const filtre = one(params.filtre);
  const q = one(params.q).trim();

  const where: Prisma.RentalWhereInput = { pharmacyId: user.pharmacyId };
  if (statut === "tous") {
    // pas de filtre
  } else if (statut in STATUS_LABELS) {
    where.status = statut as RentalStatus;
  } else {
    where.status = { in: OPEN_STATUSES };
  }
  if (type) where.typeId = type;
  if (q) {
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { deliveryNoteNumber: { contains: q, mode: "insensitive" } },
      { patient: { lastName: { contains: q, mode: "insensitive" } } },
      { patient: { firstName: { contains: q, mode: "insensitive" } } },
      { equipment: { serialNumber: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [rentals, types] = await Promise.all([
    db.rental.findMany({
      where,
      include: { patient: true, type: true, equipment: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    db.equipmentType.findMany({ where: { pharmacyId: user.pharmacyId }, orderBy: { name: "asc" } }),
  ]);

  const today = todayUTC();
  const inAWeek = addDays(today, 7);
  const shown = rentals.filter((r) => {
    if (filtre === "retard") return isLate(r, today);
    if (filtre === "a-facturer") return isBillingDue(r, today);
    if (filtre === "fin-proche") {
      return r.status === "ACTIVE" && !!r.plannedEndDate && r.plannedEndDate >= today && r.plannedEndDate <= inAWeek;
    }
    return true;
  });

  return (
    <>
      <PageHeader
        title="Dossiers de location"
        subtitle={`${shown.length} dossier${shown.length > 1 ? "s" : ""}`}
        actions={
          <Link href="/app/dossiers/nouveau" className="btn-primary">
            Nouveau dossier
          </Link>
        }
      />

      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
        <input
          name="q"
          defaultValue={q}
          placeholder="Patient, n° de dossier, n° de BL, n° de série…"
          className="input"
          aria-label="Rechercher"
        />
        <select name="statut" defaultValue={statut} className="input" aria-label="Statut">
          <option value="">Dossiers ouverts</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
          <option value="tous">Tous les dossiers</option>
        </select>
        <select name="type" defaultValue={type} className="input" aria-label="Type de matériel">
          <option value="">Tout matériel</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select name="filtre" defaultValue={filtre} className="input" aria-label="Alerte">
          <option value="">Toutes alertes</option>
          {Object.entries(FILTERS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>

      {shown.length === 0 ? (
        <EmptyState title="Aucun dossier ne correspond">Modifiez les filtres ou créez un nouveau dossier.</EmptyState>
      ) : (
        <RentalTable rentals={shown} />
      )}
    </>
  );
}
