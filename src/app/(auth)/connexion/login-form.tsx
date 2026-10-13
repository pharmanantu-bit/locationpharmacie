"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormError } from "@/components/ui";
import { login } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />
      <Field label="E-mail">
        <input name="email" type="email" required autoComplete="email" className="input" defaultValue={state?.email} />
      </Field>
      <Field label="Mot de passe">
        <input name="password" type="password" required autoComplete="current-password" className="input" />
      </Field>
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
      <p className="text-center text-sm text-slate-500">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-medium text-brand-700 hover:underline">
          Inscrire ma pharmacie
        </Link>
      </p>
    </form>
  );
}
