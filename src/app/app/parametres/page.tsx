import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { PharmacyCard } from "./pharmacy-card";
import { TeamSection } from "./team-section";

export default async function SettingsPharmacyPage() {
  const user = await requireOwner();
  const pharmacy = await db.pharmacy.findUniqueOrThrow({
    where: { id: user.pharmacyId },
    include: { users: { orderBy: [{ role: "asc" }, { createdAt: "asc" }] } },
  });

  return (
    <>
      <PharmacyCard
        pharmacy={{
          name: pharmacy.name,
          address: pharmacy.address ?? "",
          postalCode: pharmacy.postalCode ?? "",
          city: pharmacy.city ?? "",
          phone: pharmacy.phone ?? "",
          email: pharmacy.email ?? "",
          siret: pharmacy.siret ?? "",
        }}
      />
      <TeamSection
        currentUserId={user.id}
        members={pharmacy.users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }))}
      />
    </>
  );
}
