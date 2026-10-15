import { SubmitButton } from "@/components/submit-button";
import { FormError, Notice } from "@/components/ui";
import type { ConnectStatus } from "@/lib/stripe";
import { connectStripe, disconnectStripe } from "./stripe-actions";

const MESSAGES: Record<string, { ok?: string; error?: string }> = {
  retour: { ok: "Retour de Stripe : l'état du compte est mis à jour ci-dessous." },
  reprendre: { error: "Le lien Stripe a expiré. Cliquez à nouveau pour reprendre la configuration." },
  deconnecte: { ok: "Compte Stripe déconnecté de la pharmacie." },
  "cautions-ouvertes": { error: "Impossible de déconnecter : des cautions sont encore actives sur ce compte." },
  "non-configure": { error: "Stripe n'est pas configuré sur la plateforme (clé STRIPE_SECRET_KEY absente)." },
};

export function StripeSection({
  configured,
  mode,
  accountId,
  status,
  flash,
}: {
  configured: boolean;
  mode: "test" | "live" | null;
  accountId: string | null;
  status: ConnectStatus | null;
  flash?: string;
}) {
  const msg = flash ? MESSAGES[flash] : undefined;
  const ready = !!status?.chargesEnabled && !!status?.detailsSubmitted;

  return (
    <section className="card p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="font-semibold text-slate-900">Cautions par empreinte bancaire (Stripe)</h2>
        {mode === "test" && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-amber-800 uppercase ring-1 ring-amber-200">
            Mode test
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Reliez le compte Stripe de la pharmacie pour enregistrer l&apos;empreinte bancaire des patients (aucun chèque,
        aucun espèces) et débiter tout ou partie de la caution en cas de non-restitution. L&apos;argent va directement
        sur votre compte Stripe ; la plateforme n&apos;y touche jamais. Stripe prélève environ 3 % uniquement si un
        débit a lieu.
      </p>

      {msg?.error && <FormError message={msg.error} />}
      {msg?.ok && <Notice>{msg.ok}</Notice>}

      {!configured ? (
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Stripe n&apos;est pas encore activé sur la plateforme. Ajoutez <code>STRIPE_SECRET_KEY</code> dans la
          configuration du serveur pour proposer la connexion aux pharmacies.
        </p>
      ) : !accountId ? (
        <form action={connectStripe} className="mt-3">
          <SubmitButton pendingLabel="Redirection vers Stripe…">Connecter mon compte Stripe</SubmitButton>
          <p className="mt-2 text-xs text-slate-500">
            Vous serez guidé par Stripe pour créer ou relier le compte de la pharmacie (identité, IBAN). Comptez 5 à
            10 minutes. Vous pouvez interrompre et reprendre plus tard.
          </p>
        </form>
      ) : (
        <div className="mt-3 space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <Item
              label="Compte"
              value={status?.businessName ?? status?.email ?? accountId}
              sub={<code className="text-xs text-slate-500">{accountId}</code>}
            />
            <Item
              label="Configuration"
              value={status ? (status.detailsSubmitted ? "Terminée" : "Incomplète") : "Indisponible"}
              tone={status?.detailsSubmitted ? "ok" : "warn"}
              sub={status && status.requirementsDue > 0 ? `${status.requirementsDue} information(s) demandée(s) par Stripe` : undefined}
            />
            <Item
              label="Encaissements"
              value={status ? (status.chargesEnabled ? "Activés" : "Pas encore") : "Indisponible"}
              tone={status?.chargesEnabled ? "ok" : "warn"}
              sub={status ? (status.payoutsEnabled ? "Virements activés" : "Virements en attente") : undefined}
            />
          </dl>

          {ready ? (
            <Notice>Le compte est prêt : les cautions par empreinte bancaire pourront être demandées aux patients.</Notice>
          ) : (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              La configuration n&apos;est pas terminée côté Stripe. Reprenez-la pour activer les cautions.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {!ready && (
              <form action={connectStripe}>
                <SubmitButton pendingLabel="Redirection vers Stripe…">Reprendre la configuration</SubmitButton>
              </form>
            )}
            <a
              href="https://dashboard.stripe.com/"
              target="_blank"
              rel="noopener"
              className="btn-secondary"
            >
              Ouvrir le tableau de bord Stripe
            </a>
            <form action={disconnectStripe}>
              <SubmitButton
                className="btn-danger"
                pendingLabel="…"
                confirm="Déconnecter le compte Stripe de la pharmacie ? Le compte Stripe lui-même n'est pas supprimé."
              >
                Déconnecter
              </SubmitButton>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function Item({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 font-medium ${tone === "ok" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-slate-900"}`}>
        {value}
      </dd>
      {sub && <dd className="mt-0.5 text-xs text-slate-500">{sub}</dd>}
    </div>
  );
}
