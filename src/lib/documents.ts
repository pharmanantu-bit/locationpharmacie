import "server-only";
import type { DocumentKind, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import type { CurrentUser } from "./auth";
import { storage } from "./storage";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

// Types acceptés pour une ordonnance : PDF ou photo. Le contenu est vérifié par
// sa signature, pas seulement par le type annoncé par le navigateur.
const SIGNATURES: { mime: string; ext: string; magic: number[] }[] = [
  { mime: "application/pdf", ext: "pdf", magic: [0x25, 0x50, 0x44, 0x46] },
  { mime: "image/jpeg", ext: "jpg", magic: [0xff, 0xd8, 0xff] },
  { mime: "image/png", ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", ext: "webp", magic: [0x52, 0x49, 0x46, 0x46] },
];

export function detectFileType(buffer: Buffer): { mime: string; ext: string } | null {
  for (const s of SIGNATURES) {
    if (s.magic.every((b, i) => buffer[i] === b)) return { mime: s.mime, ext: s.ext };
  }
  return null;
}

export type UploadError = "empty" | "too_large" | "unsupported";

// Lit le fichier du formulaire et vérifie taille et type. Retourne null si aucun fichier n'a été joint.
export async function readUpload(
  value: FormDataEntryValue | null,
): Promise<{ buffer: Buffer; mime: string; ext: string; fileName: string } | { error: UploadError } | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > MAX_UPLOAD_BYTES) return { error: "too_large" };
  const buffer = Buffer.from(await value.arrayBuffer());
  const type = detectFileType(buffer);
  if (!type) return { error: "unsupported" };
  return { buffer, ...type, fileName: value.name || `document.${type.ext}` };
}

export const UPLOAD_ERRORS: Record<UploadError, string> = {
  empty: "Le fichier est vide.",
  too_large: "Le fichier dépasse 8 Mo.",
  unsupported: "Format non pris en charge : joignez un PDF ou une photo (JPG, PNG).",
};

// Enregistre le fichier dans le stockage puis la fiche Document en base.
export async function storeDocument(
  tx: Prisma.TransactionClient,
  user: CurrentUser,
  rentalId: string,
  kind: DocumentKind,
  file: { buffer: Buffer; mime: string; ext: string; fileName: string },
) {
  const key = `pharmacies/${user.pharmacyId}/dossiers/${rentalId}/${kind.toLowerCase()}-${randomBytes(8).toString("hex")}.${file.ext}`;
  await storage.put(key, file.buffer, file.mime);
  return tx.document.create({
    data: {
      pharmacyId: user.pharmacyId,
      rentalId,
      kind,
      storageKey: key,
      fileName: file.fileName.slice(0, 200),
      mimeType: file.mime,
      sizeBytes: file.buffer.length,
      uploadedById: user.id,
    },
  });
}
