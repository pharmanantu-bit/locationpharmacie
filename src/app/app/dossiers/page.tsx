import type { Prisma, RentalStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { RentalTable } from "@/components/rental-table";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { addDays, formatLongDay, todayUTC } from "@/lib/dates";
import { db } from "@/lib/db";
import { isBillingDue, isLate, OPEN_STATUSES, prescriptionState, STATUS_LABELS } from "@/lib/rentals";

export const metadata: Metadata = { title: "Dossiers" };

const FILTERS = {
  retard: "En retard",
  "fin-proche": "Fin sous 7 jours",
  "a-facturer": "À facturer",
  ordonnance: "Ordonnance expirée ou bientôt",
} as const;

const PAGE_SIZE = 50;

export default async function RentalsPage({ searchParams }: PageProps<"/app/dossiers">) {
  const user = await requireUser();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const statut = one(params.statut);
  const type = one(params.type);
  const filtre = one(params.filtre);
  const q = one(params.q).trim();
  const page = Math.max(1, Number(one(params.page)) || 1);

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
      { patient: { phone: { contains: q } } },
      { equipment: { serialNumber: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [rentals, types] = await Promise.all([
    db.rental.findMany({
      where,
      include: { patient: true, type: true, equipment: true },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    db.equipmentType.findMany({ where: { pharmacyId: user.pharmacyId }, orderBy: { name: "asc" } }),
  ]);

  const today = todayUTC();
  const inAWeek = addDays(today, 7);
  const shown = rentals.filter((r) => {
    if (filtre === "retard") return isLate(r, today);
    if (filtre === "a-facturer") return isBillingDue(r, today);
    if (filtre === "ordonnance") {
      const p = prescriptionState(r, today);
      return p === "expired" || p === "expiring";
    }
    if (filtre === "fin-proche") {
      return r.status === "ACTIVE" && !!r.plannedEndDate && r.plannedEndDate >= today && r.plannedEndDate <= inAWeek;
    }
    return true;
  });
  const total = shown.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (statut) sp.set("statut", statut);
    if (type) sp.set("type", type);
    if (filtre) sp.set("filtre", filtre);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return `/app/dossiers${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Dossiers"
        subtitle={formatLongDay(today)}
        actions={
          <Link href="/app/dossiers/nouveau" className="btn-primary">
            <span className="text-lg leading-none">+</span> Nouveau dossier
          </Link>
        }
      />

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Patient, n° de dossier, BL, série…"
          className="input min-w-56 flex-1 sm:max-w-sm"
          aria-label="Rechercher"
        />
        <select name="statut" defaultValue={statut} className="input w-auto shrink-0" aria-label="Statut">
          <option value="">Statut · ouverts</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
          <option value="tous">Tous les dossiers</option>
        </select>
        <select name="type" defaultValue={type} className="input w-auto shrink-0" aria-label="Type de produit">
          <option value="">Type de produit · tous</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select name="filtre" defaultValue={filtre} className="input w-auto shrink-0" aria-label="Alerte">
          <option value="">Alertes · toutes</option>
          {Object.entries(FILTERS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Filtrer</button>
        <span className="ml-auto text-sm text-slate-500">
          {total} dossier{total > 1 ? "s" : ""}
        </span>
      </form>

      {total === 0 ? (
        <EmptyState title="Aucun dossier ne correspond">Modifiez les filtres ou créez un nouveau dossier.</EmptyState>
      ) : (
        <>
          <RentalTable rentals={slice} />
          <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
            <span>
              {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, total)} sur {total}
            </span>
            {pages > 1 && (
              <span className="flex gap-2">
                {current > 1 && (
                  <Link href={pageHref(current - 1)} className="btn-secondary">
                    Précédent
                  </Link>
                )}
                <span className="self-center">
                  Page {current} / {pages}
                </span>
                {current < pages && (
                  <Link href={pageHref(current + 1)} className="btn-secondary">
                    Suivant
                  </Link>
                )}
              </span>
            )}
          </div>
        </>
      )}
    </>
  );
}
