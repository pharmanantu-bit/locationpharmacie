import Link from "next/link";
import { Logo } from "@/components/logo";

const FEATURES = [
  {
    title: "Dossiers de location",
    text: "De l'ordonnance au retour du matériel : statuts, échéances, retards et historique de chaque action.",
  },
  {
    title: "Parc en temps réel",
    text: "Chaque appareil, son état, le patient qui l'a et l'historique de ses locations.",
  },
  {
    title: "Rappels de facturation",
    text: "Les périodes à facturer dans votre LGO remontent sur le tableau de bord, plus aucun oubli.",
  },
  {
    title: "SMS de fin de contrat",
    text: "Le patient est prévenu automatiquement quelques jours avant la fin de sa location.",
    soon: true,
  },
  {
    title: "Caution par carte",
    text: "Empreinte bancaire au comptoir, débitée seulement en cas de non-restitution. Fini les chèques.",
    soon: true,
  },
  {
    title: "Contrat et factures",
    text: "Contrat pré-rempli signé sur tablette, et contrôle automatique des factures fournisseurs.",
    soon: true,
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/connexion" className="btn text-slate-700 hover:bg-slate-50">
            Connexion
          </Link>
          <Link href="/inscription" className="btn-primary">
            Essayer
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 lg:pt-24">
          <p className="text-sm font-semibold text-brand-700">Pour les pharmacies d&apos;officine</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            La location de matériel médical, sans classeur ni post-it.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-600">
            Tire-laits, aérosols, fauteuils, lits médicalisés : suivez chaque location de l&apos;ordonnance au retour,
            savez où est chaque appareil et ne laissez plus passer une facturation.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/inscription" className="btn-primary px-5 py-2.5 text-base">
              Inscrire ma pharmacie
            </Link>
            <Link href="/connexion" className="btn-secondary px-5 py-2.5 text-base">
              J&apos;ai déjà un compte
            </Link>
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-5">
                <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                  {f.title}
                  {f.soon && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      Bientôt
                    </span>
                  )}
                </h2>
                <p className="mt-2 text-sm text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100">
        <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500 sm:px-6">
          © {new Date().getFullYear()} locationenpharmacie.com
        </p>
      </footer>
    </div>
  );
}
