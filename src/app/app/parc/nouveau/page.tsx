import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { EquipmentForm } from "../equipment-form";

export const metadata: Metadata = { title: "Ajouter un appareil" };

export default async function NewEquipmentPage() {
  const user = await requireUser();
  const types = await db.equipmentType.findMany({
    where: { pharmacyId: user.pharmacyId, archived: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return (
    <>
      <PageHeader title="Ajouter un appareil" />
      <div className="card max-w-3xl p-5">
        <EquipmentForm types={types} />
      </div>
    </>
  );
}
