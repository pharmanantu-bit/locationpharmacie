import "server-only";
import type { EquipmentEventKind, Prisma } from "@prisma/client";
import type { CurrentUser } from "./auth";

// Historique de vie d'un appareil : chaque mouvement (location, retour, nettoyage,
// maintenance) laisse une trace, consultable sur la fiche de l'appareil.

export async function logEquipmentEvent(
  tx: Prisma.TransactionClient,
  user: CurrentUser,
  equipmentId: string,
  kind: EquipmentEventKind,
  message: string,
  rentalId?: string | null,
) {
  await tx.equipmentEvent.create({
    data: { pharmacyId: user.pharmacyId, equipmentId, userId: user.id, kind, message, rentalId: rentalId ?? null },
  });
}
