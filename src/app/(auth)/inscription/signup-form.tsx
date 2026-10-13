"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormError } from "@/components/ui";
import { signup } from "../actions";

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom de la pharmacie">
          <input name="pharmacyName" required className="input" placeholder="Pharmacie du Centre" />
        </Field>
        <Field label="Ville">
          <input name="city" className="input" />
        </Field>
      </div>
      <Field label="Votre nom">
        <input name="name" required autoComplete="name" className="input" />
      </Field>
      <Field label="E-mail">
        <input name="email" type="email" required autoComplete="email" className="input" defaultValue={state?.email} />
      </Field>
      <Field label="Mot de passe" hint="10 caractères minimum.">
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className="input" />
      </Field>
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Création…" : "Créer le compte"}
      </button>
      <p className="text-center text-sm text-slate-500">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-medium text-brand-700 hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
