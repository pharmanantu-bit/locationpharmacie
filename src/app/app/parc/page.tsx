import type { EquipmentStatus, Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUS_TONES } from "@/lib/rentals";

export const metadata: Metadata = { title: "Parc de matériel" };

export default async function EquipmentPage({ searchParams }: PageProps<"/app/parc">) {
  const user = await requireUser();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const type = one(params.type);
  const statut = one(params.statut);
  const q = one(params.q).trim();

  const where: Prisma.EquipmentWhereInput = { pharmacyId: user.pharmacyId };
  if (type) where.typeId = type;
  if (statut in EQUIPMENT_STATUS_LABELS) where.status = statut as EquipmentStatus;
  else where.status = { not: "RETIRED" };
  if (q) {
    where.OR = [
      { label: { contains: q, mode: "insensitive" } },
      { serialNumber: { contains: q, mode: "insensitive" } },
    ];
  }

  const [equipment, types] = await Promise.all([
    db.equipment.findMany({
      where,
      include: {
        type: true,
        rentals: { where: { status: "ACTIVE" }, include: { patient: true }, take: 1 },
      },
      orderBy: [{ type: { name: "asc" } }, { label: "asc" }],
    }),
    db.equipmentType.findMany({ where: { pharmacyId: user.pharmacyId, archived: false }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Parc de matériel"
        subtitle={`${equipment.length} appareil${equipment.length > 1 ? "s" : ""}`}
        actions={
          <Link href="/app/parc/nouveau" className="btn-primary">
            Ajouter un appareil
          </Link>
        }
      />

      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto]">
        <input name="q" defaultValue={q} placeholder="Nom ou n° de série…" className="input" aria-label="Rechercher" />
        <select name="type" defaultValue={type} className="input" aria-label="Type">
          <option value="">Tout matériel</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select name="statut" defaultValue={statut} className="input" aria-label="Statut">
          <option value="">Tous (hors retirés)</option>
          {Object.entries(EQUIPMENT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>

      {equipment.length === 0 ? (
        <EmptyState title="Aucun appareil" action={{ href: "/app/parc/nouveau", label: "Ajouter un appareil" }}>
          Enregistrez vos appareils (tire-laits, aérosols…) pour savoir à tout moment lesquels sont disponibles et chez
          qui sont les autres.
        </EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-head">Appareil</th>
                <th className="table-head">Type</th>
                <th className="table-head">N° de série</th>
                <th className="table-head">Statut</th>
                <th className="table-head">Chez</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {equipment.map((e) => {
                const current = e.rentals[0];
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="cell">
                      <Link href={`/app/parc/${e.id}`} className="font-medium text-brand-700 hover:underline">
                        {e.label}
                      </Link>
                      {e.ownership === "SUPPLIER" && (
                        <span className="block text-xs text-slate-500">Fournisseur : {e.supplier ?? "—"}</span>
                      )}
                    </td>
                    <td className="cell">{e.type.name}</td>
                    <td className="cell font-mono text-xs">{e.serialNumber ?? "—"}</td>
                    <td className="cell">
                      <Badge tone={EQUIPMENT_STATUS_TONES[e.status]}>{EQUIPMENT_STATUS_LABELS[e.status]}</Badge>
                    </td>
                    <td className="cell">
                      {current ? (
                        <Link href={`/app/dossiers/${current.id}`} className="hover:underline">
                          {current.patient.lastName.toUpperCase()} {current.patient.firstName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
