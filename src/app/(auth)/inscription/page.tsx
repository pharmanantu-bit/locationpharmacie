import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Inscription" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Inscrire ma pharmacie</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Vous serez l&apos;administrateur du compte et pourrez inviter votre équipe.
      </p>
      <SignupForm />
    </>
  );
}
