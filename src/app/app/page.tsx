import type { Metadata } from "next";
import Link from "next/link";
import { RentalTable, type RentalRow } from "@/components/rental-table";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { addDays, todayUTC } from "@/lib/dates";
import { db } from "@/lib/db";
import { getOnboarding } from "@/lib/onboarding";
import { isBillingDue, isLate, OPEN_STATUSES, prescriptionState } from "@/lib/rentals";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayUTC();
  const inAWeek = addDays(today, 7);

  const [open, types, onboarding] = await Promise.all([
    db.rental.findMany({
      where: { pharmacyId: user.pharmacyId, status: { in: OPEN_STATUSES } },
      include: { patient: true, type: true, equipment: true },
      orderBy: { plannedEndDate: "asc" },
    }),
    db.equipmentType.findMany({
      where: { pharmacyId: user.pharmacyId, archived: false },
      include: { equipment: { where: { status: { not: "RETIRED" } }, select: { status: true } } },
      orderBy: { name: "asc" },
    }),
    getOnboarding(user.pharmacyId),
  ]);

  const late = open.filter((r) => isLate(r, today));
  const endingSoon = open.filter(
    (r) => r.status === "ACTIVE" && r.plannedEndDate && r.plannedEndDate >= today && r.plannedEndDate <= inAWeek,
  );
  const toBill = open.filter((r) => isBillingDue(r, today));
  const toPrepare = open.filter((r) => r.status === "DRAFT" || r.status === "ORDERED");
  const toClose = open.filter((r) => r.status === "TO_CLOSE");
  const prescriptionIssue = open.filter((r) => {
    const p = prescriptionState(r, today);
    return p === "expired" || p === "expiring";
  });
  const active = open.filter((r) => r.status === "ACTIVE");

  const stats = [
    { label: "Locations en cours", value: active.length, href: "/app/dossiers?statut=ACTIVE" },
    { label: "En retard", value: late.length, href: "/app/dossiers?filtre=retard", alert: late.length > 0 },
    { label: "Fin sous 7 jours", value: endingSoon.length, href: "/app/dossiers?filtre=fin-proche" },
    { label: "À facturer", value: toBill.length, href: "/app/dossiers?filtre=a-facturer", alert: toBill.length > 0 },
    {
      label: "Ordonnances à renouveler",
      value: prescriptionIssue.length,
      href: "/app/dossiers?filtre=ordonnance",
      alert: prescriptionIssue.length > 0,
    },
  ];

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle={user.pharmacyName}
        actions={
          <Link href="/app/dossiers/nouveau" className="btn-primary">
            Nouveau dossier
          </Link>
        }
      />

      {onboarding.done < onboarding.total && (
        <Link
          href="/app/bien-demarrer"
          className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm transition hover:border-brand-300"
        >
          <span className="font-semibold text-brand-900">Bien démarrer</span>
          <span className="h-1.5 w-32 overflow-hidden rounded-full bg-white">
            <span
              className="block h-full rounded-full bg-brand-600"
              style={{ width: `${Math.round((onboarding.done / onboarding.total) * 100)}%` }}
            />
          </span>
          <span className="text-brand-800 tabular-nums">
            {onboarding.done} sur {onboarding.total}
          </span>
          {onboarding.next && (
            <span className="text-brand-800">
              · Prochaine étape : <span className="font-medium">{onboarding.next.title}</span>
            </span>
          )}
          <span className="ml-auto font-medium text-brand-700">Continuer →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-4 transition hover:border-slate-300">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className={`mt-1 text-3xl font-semibold tabular-nums ${s.alert ? "text-red-700" : "text-slate-900"}`}>
              {s.value}
            </p>
          </Link>
        ))}
      </div>

      {open.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Aucune location en cours"
            action={{ href: "/app/dossiers/nouveau", label: "Créer le premier dossier" }}
          >
            Créez un dossier à partir d&apos;une ordonnance : patient, matériel, dates. Le suivi se fait ensuite ici.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          <Section title="En retard de restitution" rentals={late} />
          <Section title="À facturer dans le LGO" rentals={toBill} />
          <Section title="Fin de contrat dans les 7 jours" rentals={endingSoon} />
          <Section title="Ordonnance expirée ou expirant sous 7 jours" rentals={prescriptionIssue} />
          <Section title="À préparer (en création ou commandés)" rentals={toPrepare} />
          <Section title="Matériel rendu, à clôturer" rentals={toClose} />
        </div>
      )}

      <h2 className="mt-10 mb-3 text-base font-semibold text-slate-900">Parc par type de matériel</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {types.map((t) => {
          const available = t.equipment.filter((e) => e.status === "AVAILABLE").length;
          const rented = t.equipment.filter((e) => e.status === "RENTED").length;
          const cleaning = t.equipment.filter((e) => e.status === "CLEANING").length;
          return (
            <Link key={t.id} href={`/app/parc?type=${t.id}`} className="card p-4 transition hover:border-slate-300">
              <p className="text-sm font-medium text-slate-900">{t.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                <span className="font-medium text-emerald-700">{available} dispo</span> · {rented} en location
                {cleaning > 0 && ` · ${cleaning} à nettoyer`}
              </p>
            </Link>
          );
        })}
      </div>
    </>
  );
}

function Section({ title, rentals }: { title: string; rentals: RentalRow[] }) {
  if (rentals.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-slate-900">
        {title} <span className="font-normal text-slate-400">({rentals.length})</span>
      </h2>
      <RentalTable rentals={rentals} />
    </section>
  );
}
