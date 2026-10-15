import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { addDays, daysBetween, formatLongDay, todayUTC } from "@/lib/dates";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Statistiques" };

const WINDOW_DAYS = 90;
const MONTHS = 12;

const pct = (n: number) => `${Math.round(n * 100)} %`;
const plural = (n: number, s: string) => `${n} ${s}${n > 1 ? "s" : ""}`;

// Jours d'occupation d'un appareil dans la fenêtre [from, to[ pour une location
function overlapDays(start: Date, end: Date, from: Date, to: Date): number {
  const a = Math.max(start.getTime(), from.getTime());
  const b = Math.min(end.getTime(), to.getTime());
  return b > a ? Math.round((b - a) / 86400000) : 0;
}

export default async function StatsPage() {
  const user = await requireUser();
  const today = todayUTC();
  const tomorrow = addDays(today, 1);
  const windowStart = addDays(today, -WINDOW_DAYS);
  const monthsStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (MONTHS - 1), 1));

  const [types, rentals] = await Promise.all([
    db.equipmentType.findMany({
      where: { pharmacyId: user.pharmacyId, archived: false },
      include: { equipment: { where: { status: { not: "RETIRED" } }, select: { status: true } } },
      orderBy: { name: "asc" },
    }),
    db.rental.findMany({
      where: { pharmacyId: user.pharmacyId, status: { not: "CANCELLED" } },
      select: {
        typeId: true,
        equipmentId: true,
        source: true,
        status: true,
        startDate: true,
        returnDate: true,
        createdAt: true,
      },
    }),
  ]);

  // --- Par type de matériel -------------------------------------------------
  const perType = types.map((t) => {
    const mine = rentals.filter((r) => r.typeId === t.id);
    const total = t.equipment.length;
    const rentedNow = t.equipment.filter((e) => e.status === "RENTED").length;
    const availableNow = t.equipment.filter((e) => e.status === "AVAILABLE").length;
    const cleaningNow = t.equipment.filter((e) => e.status === "CLEANING" || e.status === "MAINTENANCE").length;

    // Occupation sur la fenêtre : jours loués (appareils du parc) / jours disponibles
    const rentedDays = mine
      .filter((r) => r.equipmentId && r.startDate)
      .reduce((sum, r) => sum + overlapDays(r.startDate!, r.returnDate ?? tomorrow, windowStart, tomorrow), 0);
    const capacityDays = total * WINDOW_DAYS;

    const closed = mine.filter((r) => r.startDate && r.returnDate);
    const avgDuration = closed.length
      ? closed.reduce((s, r) => s + daysBetween(r.startDate!, r.returnDate!), 0) / closed.length
      : null;

    const inWindow = mine.filter((r) => r.createdAt >= windowStart);
    return {
      id: t.id,
      name: t.name,
      total,
      rentedNow,
      availableNow,
      cleaningNow,
      occupancyNow: total ? rentedNow / total : null,
      occupancyWindow: capacityDays ? Math.min(1, rentedDays / capacityDays) : null,
      rentalsWindow: inWindow.length,
      supplierWindow: inWindow.filter((r) => r.source === "SUPPLIER").length,
      avgDuration,
    };
  });

  // Types équipés d'abord, par occupation décroissante, puis par activité
  perType.sort(
    (a, b) =>
      (b.occupancyWindow ?? -1) - (a.occupancyWindow ?? -1) || b.rentalsWindow - a.rentalsWindow || a.name.localeCompare(b.name),
  );

  // --- Globaux ---------------------------------------------------------------
  const fleet = perType.reduce((s, t) => s + t.total, 0);
  const rentedNow = perType.reduce((s, t) => s + t.rentedNow, 0);
  const rentedDaysAll = perType.reduce((s, t) => s + (t.occupancyWindow ?? 0) * t.total * WINDOW_DAYS, 0);
  const occupancyWindow = fleet ? rentedDaysAll / (fleet * WINDOW_DAYS) : null;
  const active = rentals.filter((r) => r.status === "ACTIVE").length;
  const createdWindow = rentals.filter((r) => r.createdAt >= windowStart).length;
  const closedAll = rentals.filter((r) => r.startDate && r.returnDate);
  const avgDurationAll = closedAll.length
    ? closedAll.reduce((s, r) => s + daysBetween(r.startDate!, r.returnDate!), 0) / closedAll.length
    : null;
  const supplierShare = createdWindow
    ? rentals.filter((r) => r.createdAt >= windowStart && r.source === "SUPPLIER").length / createdWindow
    : null;

  // --- Dossiers créés par mois (12 derniers mois) ---------------------------
  const months = Array.from({ length: MONTHS }, (_, i) => {
    const d = new Date(Date.UTC(monthsStart.getUTCFullYear(), monthsStart.getUTCMonth() + i, 1));
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    const count = rentals.filter((r) => r.createdAt >= d && r.createdAt < next).length;
    return {
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("fr-FR", { timeZone: "UTC", month: "short" }).replace(".", ""),
      full: d.toLocaleDateString("fr-FR", { timeZone: "UTC", month: "long", year: "numeric" }),
      count,
    };
  });
  const maxMonth = Math.max(1, ...months.map((m) => m.count));
  const peak = months.reduce((best, m) => (m.count > best.count ? m : best), months[0]);

  const tiles = [
    { label: "Taux d'occupation du parc", value: occupancyWindow == null ? "—" : pct(occupancyWindow), hint: `sur ${WINDOW_DAYS} jours` },
    { label: "Occupation aujourd'hui", value: fleet ? `${rentedNow} / ${fleet}` : "—", hint: "appareils loués / parc" },
    { label: "Locations en cours", value: String(active), hint: "dossiers actifs" },
    { label: `Dossiers créés (${WINDOW_DAYS} j)`, value: String(createdWindow), hint: supplierShare == null ? "" : `${pct(supplierShare)} via fournisseur` },
    { label: "Durée moyenne", value: avgDurationAll == null ? "—" : `${Math.round(avgDurationAll)} j`, hint: `sur ${plural(closedAll.length, "location terminée")}` },
  ];

  return (
    <>
      <PageHeader title="Statistiques" subtitle={formatLongDay(today)} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="card p-4">
            <p className="text-sm text-slate-500">{t.label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{t.value}</p>
            {t.hint && <p className="mt-0.5 text-xs text-slate-500">{t.hint}</p>}
          </div>
        ))}
      </div>

      <section className="card mt-8 p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Dossiers créés par mois</h2>
          <p className="text-sm text-slate-500">
            {peak.count > 0 ? `Pic : ${peak.full} (${plural(peak.count, "dossier")})` : "Aucun dossier sur 12 mois"}
          </p>
        </div>
        <figure>
          <div className="flex h-44 items-end gap-1.5 border-b border-slate-200 sm:gap-2" role="img" aria-label="Dossiers créés par mois sur les 12 derniers mois">
            {months.map((m, i) => {
              const h = Math.max(m.count ? 4 : 2, Math.round((m.count / maxMonth) * 160));
              const isLast = i === months.length - 1;
              return (
                <div key={m.key} className="group relative flex flex-1 flex-col items-center justify-end" title={`${m.full} : ${plural(m.count, "dossier")}`}>
                  <span className={`mb-1 text-xs tabular-nums ${isLast || m.key === peak.key ? "text-slate-700" : "text-transparent group-hover:text-slate-700"}`}>
                    {m.count}
                  </span>
                  <div
                    className={`w-full max-w-7 rounded-t ${m.count ? "bg-brand-600 group-hover:bg-brand-700" : "bg-slate-200"}`}
                    style={{ height: `${h}px` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex gap-1.5 sm:gap-2">
            {months.map((m) => (
              <span key={m.key} className="flex-1 text-center text-[11px] text-slate-500">
                {m.label}
              </span>
            ))}
          </div>
        </figure>
      </section>

      <section className="mt-8">
        <h2 className="mb-1 font-semibold text-slate-900">Occupation et activité par type de matériel</h2>
        <p className="mb-3 text-sm text-slate-500">
          Taux d&apos;occupation = jours loués des appareils du parc rapportés aux jours disponibles sur {WINDOW_DAYS} jours.
          Les dossiers servis par un fournisseur montrent la demande que le parc ne couvre pas.
        </p>
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr>
                <th className="table-head">Matériel</th>
                <th className="table-head">Parc</th>
                <th className="table-head">Aujourd&apos;hui</th>
                <th className="table-head">Occupation {WINDOW_DAYS} j</th>
                <th className="table-head">Dossiers {WINDOW_DAYS} j</th>
                <th className="table-head">Via fournisseur</th>
                <th className="table-head">Durée moyenne</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {perType.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="cell font-medium text-slate-900">{t.name}</td>
                  <td className="cell text-slate-600">{t.total ? plural(t.total, "appareil") : "—"}</td>
                  <td className="cell text-slate-600">
                    {t.total ? (
                      <>
                        <span className="font-medium text-slate-900">{t.rentedNow} loué{t.rentedNow > 1 ? "s" : ""}</span>
                        {" · "}
                        {t.availableNow} dispo
                        {t.cleaningNow > 0 && ` · ${t.cleaningNow} en entretien`}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="cell">
                    {t.occupancyWindow == null ? (
                      <span className="text-slate-400">pas d&apos;appareil</span>
                    ) : (
                      <div className="flex items-center gap-2" title={`${pct(t.occupancyWindow)} sur ${WINDOW_DAYS} jours`}>
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.round(t.occupancyWindow * 100)}%` }} />
                        </div>
                        <span className="w-10 text-right text-sm tabular-nums text-slate-900">{pct(t.occupancyWindow)}</span>
                      </div>
                    )}
                  </td>
                  <td className="cell tabular-nums text-slate-900">{t.rentalsWindow}</td>
                  <td className="cell tabular-nums text-slate-600">
                    {t.supplierWindow}
                    {t.rentalsWindow > 0 && t.supplierWindow > 0 && (
                      <span className="text-xs text-slate-500"> ({pct(t.supplierWindow / t.rentalsWindow)})</span>
                    )}
                  </td>
                  <td className="cell tabular-nums text-slate-600">{t.avgDuration == null ? "—" : `${Math.round(t.avgDuration)} j`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
