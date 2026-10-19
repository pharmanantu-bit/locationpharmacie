"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, Notice } from "@/components/ui";
import { addMember, removeMember, updateMember, type SettingsFormState } from "./actions";
import { Avatar, PencilIcon, PlusIcon, SettingsCard } from "./settings-ui";

export type Member = { id: string; name: string; email: string; role: "OWNER" | "MEMBER" };

const ROLE_LABELS: Record<Member["role"], string> = { OWNER: "Administrateur", MEMBER: "Opérateur" };

export function TeamSection({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Confirmation affichée en tête de liste une fois un formulaire refermé
  const [flash, setFlash] = useState<string | null>(null);

  return (
    <SettingsCard
      id="operateurs"
      title="Opérateurs"
      description="Chaque opérateur a son propre accès. Ses actions sont tracées à son nom dans l'historique des dossiers."
      action={
        !adding && (
          <button type="button" onClick={() => setAdding(true)} className="btn-primary">
            <PlusIcon />
            Ajouter
          </button>
        )
      }
    >
      {flash && !adding && !editingId && (
        <div className="mb-4">
          <Notice>{flash}</Notice>
        </div>
      )}

      {adding && (
        <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50/40 p-4">
          <AddMemberForm
            onDone={(message) => {
              setFlash(message);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      <ul className="divide-y divide-slate-100">
        {members.map((m) => (
          <li key={m.id} className="py-3">
            <div className="flex items-center gap-4">
              <Avatar name={m.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">
                  {m.name}
                  {m.id === currentUserId && <span className="ml-2 text-xs font-normal text-slate-400">(vous)</span>}
                </p>
                <p className="truncate text-sm text-slate-500">
                  {ROLE_LABELS[m.role]} · {m.email}
                </p>
              </div>
              {m.id === currentUserId ? (
                <Link href="/app/parametres/acces" className="btn-secondary" title="Modifier mon compte">
                  <PencilIcon />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingId(editingId === m.id ? null : m.id)}
                  className="btn-secondary"
                  title={`Modifier ${m.name}`}
                  aria-expanded={editingId === m.id}
                >
                  <PencilIcon />
                </button>
              )}
            </div>
            {editingId === m.id && (
              <div className="mt-3 ml-0 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:ml-15">
                <EditMemberForm
                  member={m}
                  onDone={(message) => {
                    setFlash(message);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}

function AddMemberForm({ onDone, onCancel }: { onDone: (message: string) => void; onCancel: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: SettingsFormState, formData: FormData) => {
      const result = await addMember(prev, formData);
      if (result?.ok) onDone(result.ok);
      return result;
    },
    undefined,
  );
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm font-medium text-slate-900">Nouvel opérateur</p>
      <FormError message={state?.error} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Nom">
          <input name="name" required className="input" autoFocus />
        </Field>
        <Field label="E-mail">
          <input name="email" type="email" required className="input" />
        </Field>
        <Field label="Mot de passe provisoire" hint="10 caractères minimum. À communiquer à l'opérateur.">
          <input name="password" type="text" required minLength={10} className="input" autoComplete="off" />
        </Field>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Ajout…" : "Ajouter l'opérateur"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={pending}>
          Annuler
        </button>
      </div>
    </form>
  );
}

function EditMemberForm({
  member,
  onDone,
  onCancel,
}: {
  member: Member;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(
    async (prev: SettingsFormState, formData: FormData) => {
      const result = await updateMember(prev, formData);
      if (result?.ok) onDone(result.ok);
      return result;
    },
    undefined,
  );
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-3">
        <input type="hidden" name="userId" value={member.id} />
        <FormError message={state?.error} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom">
            <input name="name" required defaultValue={member.name} className="input" />
          </Field>
          <Field label="Nouveau mot de passe" hint="Laissez vide pour ne pas le changer.">
            <input name="password" type="text" minLength={10} className="input" autoComplete="off" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={pending}>
            Annuler
          </button>
        </div>
      </form>
      <form action={removeMember} className="border-t border-slate-200 pt-3">
        <input type="hidden" name="userId" value={member.id} />
        <SubmitButton className="btn-danger" pendingLabel="…" confirm={`Retirer l'accès de ${member.name} ?`}>
          Retirer l&apos;accès
        </SubmitButton>
      </form>
    </div>
  );
}
