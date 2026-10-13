import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { OPEN_STATUSES } from "@/lib/rentals";

export const metadata: Metadata = { title: "Patients" };

export default async function PatientsPage({ searchParams }: PageProps<"/app/patients">) {
  const user = await requireUser();
  const { q: rawQ } = await searchParams;
  const q = (typeof rawQ === "string" ? rawQ : "").trim();

  const where: Prisma.PatientWhereInput = { pharmacyId: user.pharmacyId };
  if (q) {
    where.OR = [
      { lastName: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }
  const patients = await db.patient.findMany({
    where,
    include: {
      _count: { select: { rentals: true } },
      rentals: { where: { status: { in: OPEN_STATUSES } }, select: { id: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 500,
  });

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle="Les patients sont créés depuis un nouveau dossier de location."
        actions={
          <Link href="/app/dossiers/nouveau" className="btn-primary">
            Nouveau dossier
          </Link>
        }
      />
      <form className="card mb-4 flex gap-3 p-4">
        <input name="q" defaultValue={q} placeholder="Nom, prénom ou téléphone…" className="input" aria-label="Rechercher" />
        <button className="btn-secondary">Rechercher</button>
      </form>

      {patients.length === 0 ? (
        <EmptyState title={q ? "Aucun patient trouvé" : "Aucun patient pour l'instant"} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-head">Patient</th>
                <th className="table-head">Téléphone</th>
                <th className="table-head">Locations en cours</th>
                <th className="table-head">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="cell">
                    <Link href={`/app/patients/${p.id}`} className="font-medium text-brand-700 hover:underline">
                      {p.lastName.toUpperCase()} {p.firstName}
                    </Link>
                  </td>
                  <td className="cell">{p.phone ?? "—"}</td>
                  <td className="cell tabular-nums">{p.rentals.length}</td>
                  <td className="cell tabular-nums">{p._count.rentals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
