import type { Metadata } from "next";
import Link from "next/link";
import { StatusPill } from "@/components/rental-table";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { daysBetween, formatDay, formatLongDay, todayUTC } from "@/lib/dates";
import { db } from "@/lib/db";
import { STATUS_LABELS } from "@/lib/rentals";

export const metadata: Metadata = { title: "Contrôle des factures fournisseurs" };

// Contrôle des factures fournisseurs (prestataires de location, ex. tire-laits).
// Cette page établit, dossier par dossier, la période que le prestataire est en droit
// de facturer : de la remise au patient jusqu'au retour. L'import des factures et le
// rapprochement automatique par n° de BL viendront avec le modèle de facture du prestataire.

export default async function InvoiceControlPage({ searchParams }: PageProps<"/app/controle">) {
  const user = await requireUser();
  const { fournisseur } = await searchParams;
  const selected = typeof fournisseur === "string" ? fournisseur : "";
  const today = todayUTC();

  const rentals = await db.rental.findMany({
    where: { pharmacyId: user.pharmacyId, source: "SUPPLIER", status: { notIn: ["CANCELLED", "DRAFT"] } },
    include: { patient: true, type: true },
    orderBy: [{ supplier: "asc" }, { startDate: "desc" }],
  });

  const suppliers = Array.from(new Set(rentals.map((r) => r.supplier ?? "Prestataire non renseigné"))).sort();
  const shown = rentals.filter((r) => !selected || (r.supplier ?? "Prestataire non renseigné") === selected);

  const ongoing = shown.filter((r) => r.status === "ORDERED" || r.status === "ACTIVE");
  const returned = shown.filter((r) => r.returnDate);
  const missingBl = shown.filter((r) => !r.deliveryNoteNumber);

  return (
    <>
      <PageHeader title="Contrôle des factures" subtitle={formatLongDay(today)} />

      <div className="mb-6 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900">
        <p className="font-medium">Ce que vérifie ce contrôle</p>
        <p className="mt-1">
          Pour chaque appareil loué via un prestataire, la période facturable va de la remise au patient jusqu&apos;au
          retour. Toute ligne de facture au-delà de la date de retour, ou sans dossier correspondant, est une anomalie.
          L&apos;import des factures (rapprochement automatique par n° de bon de livraison) sera ajouté dès réception
          d&apos;un modèle de facture du prestataire.
        </p>
      </div>

      {rentals.length === 0 ? (
        <EmptyState title="Aucune location via un prestataire">
          Les dossiers dont la source est « Commande fournisseur » apparaîtront ici avec leur période facturable.
        </EmptyState>
      ) : (
        <>
          <form className="mb-4 flex flex-wrap items-center gap-2">
            <select name="fournisseur" defaultValue={selected} className="input w-auto" aria-label="Prestataire">
              <option value="">Tous les prestataires</option>
              {suppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className="btn-secondary">Filtrer</button>
          </form>

          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Locations en cours" value={ongoing.length} hint="facturation attendue" />
            <Tile label="Appareils rendus" value={returned.length} hint="plus rien à facturer après la date de retour" />
            <Tile
              label="Sans n° de BL"
              value={missingBl.length}
              hint="à compléter pour rapprocher les factures"
              alert={missingBl.length > 0}
            />
            <Tile label="Prestataires" value={suppliers.length} />
          </div>

          <div className="card overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="table-head">Prestataire</th>
                  <th className="table-head">Patient</th>
                  <th className="table-head">Matériel</th>
                  <th className="table-head">N° de BL</th>
                  <th className="table-head">Remis le</th>
                  <th className="table-head">Rendu le</th>
                  <th className="table-head">Période facturable</th>
                  <th className="table-head">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((r) => {
                  const end = r.returnDate ?? today;
                  const days = r.startDate ? daysBetween(r.startDate, end) + (r.returnDate ? 1 : 0) : null;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="cell text-slate-700">{r.supplier ?? <span className="text-amber-700">Non renseigné</span>}</td>
                      <td className="cell font-semibold text-slate-900">
                        {r.patient.lastName.toUpperCase()} {r.patient.firstName}
                      </td>
                      <td className="cell text-slate-700">{r.type.name}</td>
                      <td className="cell font-mono text-xs">
                        {r.deliveryNoteNumber ?? <span className="font-sans text-amber-700">manquant</span>}
                      </td>
                      <td className="cell whitespace-nowrap text-slate-600">{formatDay(r.startDate)}</td>
                      <td className="cell whitespace-nowrap">
                        {r.returnDate ? (
                          <span className="font-medium text-slate-900">{formatDay(r.returnDate)}</span>
                        ) : (
                          <StatusPill kind={r.status}>{STATUS_LABELS[r.status]}</StatusPill>
                        )}
                      </td>
                      <td className="cell whitespace-nowrap text-slate-600">
                        {r.startDate ? (
                          <>
                            du {formatDay(r.startDate)} au {r.returnDate ? formatDay(r.returnDate) : "retour"}
                            {days != null && <span className="text-xs text-slate-500"> · {days} j{r.returnDate ? "" : " à ce jour"}</span>}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="cell">
                        <Link href={`/app/dossiers/${r.id}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">
                          {r.number}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function Tile({ label, value, hint, alert }: { label: string; value: number; hint?: string; alert?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${alert ? "text-amber-700" : "text-slate-900"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
