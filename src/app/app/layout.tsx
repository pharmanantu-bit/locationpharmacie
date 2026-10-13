import { requireUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { NavLinks } from "./nav-links";
import { logout } from "../(auth)/actions";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-4 py-4 lg:px-5 lg:py-5">
          <Logo />
          <form action={logout} className="lg:hidden">
            <button className="text-xs font-medium text-slate-500 hover:text-slate-900">Déconnexion</button>
          </form>
        </div>
        <NavLinks isOwner={user.role === "OWNER"} />
        <div className="hidden border-t border-slate-200 px-5 py-4 lg:mt-auto lg:block">
          <p className="truncate text-sm font-medium text-slate-900">{user.pharmacyName}</p>
          <p className="truncate text-xs text-slate-500">{user.name}</p>
          <form action={logout} className="mt-3">
            <button className="text-xs font-medium text-slate-500 hover:text-slate-900">Se déconnecter</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
