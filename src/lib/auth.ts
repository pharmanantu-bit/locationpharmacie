import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";

const COOKIE = "lep_session";
const SESSION_DAYS = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(COOKIE);
}

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "MEMBER";
  pharmacyId: string;
  pharmacyName: string;
};

// Mémorisé le temps d'une requête : layout, page et actions partagent la lecture
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { include: { pharmacy: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    pharmacyId: user.pharmacyId,
    pharmacyName: user.pharmacy.name,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "OWNER") redirect("/app");
  return user;
}
