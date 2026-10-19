"use client";

import { useActionState } from "react";
import { Field, FormError, Notice } from "@/components/ui";
import { changePassword, updateAccount } from "../actions";

export function AccountForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(updateAccount, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />
      {state?.ok && <Notice>{state.ok}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom">
          <input name="name" required defaultValue={name} className="input" />
        </Field>
        <Field label="E-mail de connexion">
          <input name="email" type="email" required defaultValue={email} className="input" />
        </Field>
      </div>
      <button className="btn-primary" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="space-y-4" key={state?.ok}>
      <FormError message={state?.error} />
      {state?.ok && <Notice>{state.ok}</Notice>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Mot de passe actuel">
          <input name="current" type="password" required className="input" autoComplete="current-password" />
        </Field>
        <Field label="Nouveau mot de passe" hint="10 caractères minimum.">
          <input name="password" type="password" required minLength={10} className="input" autoComplete="new-password" />
        </Field>
        <Field label="Confirmation">
          <input name="confirm" type="password" required minLength={10} className="input" autoComplete="new-password" />
        </Field>
      </div>
      <button className="btn-primary" disabled={pending}>
        {pending ? "Modification…" : "Changer le mot de passe"}
      </button>
    </form>
  );
}
