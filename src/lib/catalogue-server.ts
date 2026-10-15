import "server-only";
import type { Prisma } from "@prisma/client";
import { CATALOGUE } from "./catalogue";
import { db } from "./db";

type Client = Prisma.TransactionClient | typeof db;

// Garantit que le catalogue commun est présent en base (idempotent).
export async function ensureCatalogue(client: Client = db) {
  const existing = await client.catalogueItem.findMany({ select: { slug: true } });
  const known = new Set(existing.map((c) => c.slug));
  const missing = CATALOGUE.filter((c) => !known.has(c.slug));
  if (missing.length > 0) {
    await client.catalogueItem.createMany({
      data: missing.map((c, i) => ({ ...c, sortOrder: CATALOGUE.indexOf(c) + i })),
      skipDuplicates: true,
    });
  }
  return client.catalogueItem.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
}
