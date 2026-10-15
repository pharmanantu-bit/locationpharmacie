import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { GROUP_LABELS, getOnboarding, type OnboardingGroup, type OnboardingStep } from "@/lib/onboarding";
import { toggleOnboardingStep } from "./actions";

export const metadata: Metadata = { title: "Bien démarrer" };

const GROUPS: OnboardingGroup[] = ["setup", "try", "launch"];

export default async function OnboardingPage() {
  const user = await requireUser();
  const { steps, done, total, next } = await getOnboarding(user.pharmacyId);
  const isOwner = user.role === "OWNER";

  return (
    <>
      <PageHeader
        title="Bien démarrer avec locationenpharmacie.com"
        subtitle="Quelques étapes pour être prêts le jour où un patient arrive avec une ordonnance de location."
      />

      <div className="card mb-6 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
          <p className="text-sm font-semibold text-slate-900 tabular-nums">
            {done} sur {total}
          </p>
        </div>
        {done === total ? (
          <p className="mt-3 text-sm text-emerald-700">
            Tout est en place. Votre équipe peut ouvrir des dossiers de location.
          </p>
        ) : (
          next && (
            <p className="mt-3 text-sm text-slate-600">
              Prochaine étape : <span className="font-medium text-slate-900">{next.title}</span>
            </p>
          )
        )}
      </div>

      <div className="space-y-6">
        {GROUPS.map((group) => {
          const items = steps.filter((s) => s.group === group);
          const groupDone = items.filter((s) => s.done).length;
          return (
            <section key={group} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-2.5">
                <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{GROUP_LABELS[group]}</h2>
                <span className="text-xs font-medium text-slate-500 tabular-nums">
                  {groupDone}/{items.length}
                </span>
              </div>
              <ol className="divide-y divide-slate-100">
                {items.map((step) => (
                  <StepItem
                    key={step.key}
                    step={step}
                    number={steps.indexOf(step) + 1}
                    open={step.key === next?.key}
                    canAct={isOwner || !step.ownerOnly}
                  />
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </>
  );
}

function StepItem({
  step,
  number,
  open,
  canAct,
}: {
  step: OnboardingStep;
  number: number;
  open: boolean;
  canAct: boolean;
}) {
  return (
    <li>
      <details open={open} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
          <span
            className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ring-1 ring-inset ${
              step.done ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-slate-600 ring-slate-300"
            }`}
            aria-label={step.done ? "Fait" : "À faire"}
          >
            {step.done ? "✓" : number}
          </span>
          <span className={`flex-1 text-sm font-medium ${step.done ? "text-slate-500 line-through decoration-slate-300" : "text-slate-900"}`}>
            {step.title}
          </span>
          <svg
            viewBox="0 0 24 24"
            className="size-4 shrink-0 text-slate-400 transition group-open:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div className="px-5 pb-4 pl-14">
          <p className="text-sm text-slate-600">{step.description}</p>
          {!canAct ? (
            <p className="mt-2 text-xs text-slate-500">Cette étape est réservée à l&apos;administrateur de la pharmacie.</p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!step.done && (
                <Link href={step.href} className="btn-primary">
                  {step.cta} →
                </Link>
              )}
              {step.manual && (
                <form action={toggleOnboardingStep}>
                  <input type="hidden" name="step" value={step.key} />
                  <SubmitButton className="btn-secondary" pendingLabel="…">
                    {step.done ? "Marquer comme à faire" : "Marquer comme fait"}
                  </SubmitButton>
                </form>
              )}
              {step.done && !step.manual && (
                <Link href={step.href} className="text-sm text-slate-500 hover:text-slate-900">
                  Revoir
                </Link>
              )}
            </div>
          )}
        </div>
      </details>
    </li>
  );
}
