import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Stockage des fichiers (ordonnances, contrats).
// La base ne garde que la clé ; le contenu vit ici.
//
// - local : dossier STORAGE_DIR (./storage par défaut), pour le développement.
// - s3    : prévu pour la production chez l'hébergeur HDS (bucket S3 compatible,
//           chiffré au repos). À brancher au moment du déploiement.

export type StoredObject = { body: Buffer; contentType: string };

interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9/_.-]*$/i;

function assertKey(key: string) {
  if (!KEY_PATTERN.test(key) || key.includes("..")) throw new Error("Clé de stockage invalide.");
}

function localDriver(): StorageDriver {
  const root = path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"));
  const resolve = (key: string) => {
    assertKey(key);
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("Clé de stockage invalide.");
    return full;
  };
  return {
    async put(key, body, contentType) {
      const full = resolve(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, body);
      // Le type MIME est stocké à côté : le système de fichiers ne le garde pas
      await writeFile(`${full}.meta`, JSON.stringify({ contentType }));
    },
    async get(key) {
      const full = resolve(key);
      try {
        const [body, meta] = await Promise.all([readFile(full), readFile(`${full}.meta`, "utf8")]);
        return { body, contentType: (JSON.parse(meta) as { contentType: string }).contentType };
      } catch {
        return null;
      }
    },
    async delete(key) {
      const full = resolve(key);
      await rm(full, { force: true });
      await rm(`${full}.meta`, { force: true });
    },
  };
}

function s3Driver(): StorageDriver {
  const fail = () => {
    throw new Error(
      "STORAGE_DRIVER=s3 n'est pas encore branché : à faire au déploiement chez l'hébergeur HDS.",
    );
  };
  return { put: fail, get: fail, delete: fail };
}

export const storage: StorageDriver = process.env.STORAGE_DRIVER === "s3" ? s3Driver() : localDriver();
