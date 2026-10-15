import { requireUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { todayUTC } from "@/lib/dates";
import { db } from "@/lib/db";
import { getOnboarding } from "@/lib/onboarding";
import { isBillingDue, OPEN_STATUSES } from "@/lib/rentals";
import { NavLinks, type NavBadges } from "./nav-links";
import { logout } from "../(auth)/actions";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();
  const today = todayUTC();

  // Compteurs d'alertes affichés dans la barre latérale
  const [late, toBill, cleaning, onboarding] = await Promise.all([
    db.rental.count({ where: { pharmacyId: user.pharmacyId, status: "ACTIVE", plannedEndDate: { lt: today } } }),
    db.rental.findMany({
      where: { pharmacyId: user.pharmacyId, status: { in: OPEN_STATUSES } },
      select: { status: true, startDate: true, billedUntil: true, billingPeriod: true, returnDate: true, plannedEndDate: true },
    }),
    db.equipment.count({ where: { pharmacyId: user.pharmacyId, status: "CLEANING" } }),
    getOnboarding(user.pharmacyId),
  ]);
  const badges: NavBadges = {
    dossiers: late,
    facturation: toBill.filter((r) => isBillingDue(r, today)).length,
    parc: cleaning,
  };

  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="bg-slate-900 text-slate-200 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col">
        <div className="flex items-center justify-between px-4 py-4 lg:px-5">
          <Logo light />
          <form action={logout} className="lg:hidden">
            <button className="text-xs font-medium text-slate-400 hover:text-white">Déconnexion</button>
          </form>
        </div>

        <div className="mx-4 mb-3 hidden rounded-lg bg-white/5 px-3 py-2 lg:block">
          <p className="truncate text-sm font-semibold text-white">{user.pharmacyName}</p>
          <p className="text-xs text-slate-400">{user.role === "OWNER" ? "Administrateur" : "Équipe"}</p>
        </div>

        <form action="/app/dossiers" className="mx-4 mb-3 hidden lg:block">
          <label className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-400 focus-within:bg-white/10">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              name="q"
              placeholder="Rechercher un patient…"
              className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none"
              aria-label="Rechercher"
            />
          </label>
        </form>

        <NavLinks
          isOwner={user.role === "OWNER"}
          badges={badges}
          onboarding={{ done: onboarding.done, total: onboarding.total }}
        />

        <div className="hidden border-t border-white/10 px-4 py-3 lg:mt-auto lg:block">
          <div className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-700 text-xs font-semibold text-white">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>
            <form action={logout}>
              <button className="text-xs text-slate-400 hover:text-white" title="Se déconnecter">
                Sortir
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
