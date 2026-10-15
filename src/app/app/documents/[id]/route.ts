import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

// Lecture d'un document (ordonnance, contrat) : réservée à l'équipe de la pharmacie
// propriétaire du dossier, et tracée dans le journal d'audit.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non connecté", { status: 401 });
  const { id } = await params;

  const doc = await db.document.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
  if (!doc) return new Response("Introuvable", { status: 404 });

  const object = await storage.get(doc.storageKey);
  if (!object) return new Response("Fichier absent du stockage", { status: 404 });

  await audit(db, user, "document.view", "Document", doc.id);

  const safeName = doc.fileName.replace(/[^\w.() -]+/g, "_");
  return new Response(new Uint8Array(object.body), {
    headers: {
      "Content-Type": object.contentType,
      "Content-Length": String(object.body.length),
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
