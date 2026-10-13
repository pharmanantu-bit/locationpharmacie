import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Connexion</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Accédez aux locations de votre pharmacie.</p>
      <LoginForm />
    </>
  );
}
