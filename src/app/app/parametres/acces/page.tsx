import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { Avatar, SettingsCard } from "../settings-ui";
import { AccountForm, PasswordForm } from "./account-forms";

export const metadata: Metadata = { title: "Accès" };

export default async function AccessPage() {
  const user = await requireOwner();
  return (
    <>
      <SettingsCard
        id="compte"
        title="Votre compte"
        description="Le compte administrateur de la pharmacie. Il gère les réglages et les accès des opérateurs."
      >
        <div className="mb-5 flex items-center gap-4">
          <Avatar name={user.name} size="lg" />
          <div>
            <p className="font-semibold text-slate-900">{user.name}</p>
            <p className="text-sm text-slate-500">Administrateur · {user.email}</p>
          </div>
        </div>
        <AccountForm name={user.name} email={user.email} />
      </SettingsCard>

      <SettingsCard
        id="mot-de-passe"
        title="Mot de passe"
        description="Choisissez un mot de passe d'au moins 10 caractères, différent de ceux utilisés ailleurs."
      >
        <PasswordForm />
      </SettingsCard>

      <SettingsCard
        id="operateurs"
        title="Accès des opérateurs"
        description="Les opérateurs se connectent avec leur propre adresse. Vous pouvez réinitialiser leur mot de passe ou retirer un accès à tout moment."
      >
        <Link href="/app/parametres#operateurs" className="btn-secondary">
          Gérer les opérateurs
        </Link>
      </SettingsCard>
    </>
  );
}
