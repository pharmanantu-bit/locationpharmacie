import "server-only";
import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "./auth";
import { db } from "./db";

// Journal d'audit : exigé pour l'hébergement de données de santé.
// On y trace les accès et modifications sensibles (ordonnances, patients).

type Client = Prisma.TransactionClient | typeof db;

export async function audit(
  client: Client,
  user: CurrentUser,
  action: string,
  targetType: string,
  targetId: string,
) {
  await client.auditLog.create({
    data: { pharmacyId: user.pharmacyId, userId: user.id, action, targetType, targetId },
  });
}
