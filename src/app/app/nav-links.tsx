"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavBadges = { dossiers: number; facturation: number; parc: number };

type Item = {
  href: string;
  label: string;
  exact?: boolean;
  ownerOnly?: boolean;
  soon?: boolean;
  badge?: keyof NavBadges;
  tag?: string;
};

const MAIN: Item[] = [
  { href: "/app", label: "Tableau de bord", exact: true },
  { href: "/app/dossiers", label: "Dossiers", badge: "dossiers" },
  { href: "/app/dossiers?filtre=a-facturer", label: "Facturation", badge: "facturation" },
];

const GESTION: Item[] = [
  { href: "/app/parc", label: "Mon parc", badge: "parc" },
  { href: "/app/patients", label: "Patients" },
  { href: "/app/statistiques", label: "Statistiques" },
  { href: "/app/controle", label: "Contrôle factures", tag: "bêta" },
  { href: "/app/visibilite", label: "Visibilité", soon: true, tag: "bientôt" },
  { href: "/app/parametres", label: "Réglages", ownerOnly: true },
];

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    "/app": "M4 5h7v6H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 13h7v6H4z",
    "/app/dossiers": "M4 6h16v12H4zM8 10h8M8 14h5",
    "/app/dossiers?filtre=a-facturer": "M6 4h12v16l-3-2-3 2-3-2-3 2zM9 9h6M9 13h6",
    "/app/parc": "M4 8h16v10H4zM8 8V5h8v3",
    "/app/patients": "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0",
    "/app/statistiques": "M5 19V9M12 19V5M19 19v-7",
    "/app/controle": "M5 12l4 4L19 6",
    "/app/visibilite": "M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "/app/parametres": "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3.9a7 7 0 0 0-1.8-1L14.4 3H9.6l-.4 2.5a7 7 0 0 0-1.8 1L5.1 5.6l-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 1.8 1l.4 2.5h4.8l.4-2.5a7 7 0 0 0 1.8-1l2.3.9 2-3.4-2-1.5c.1-.3.1-.7.1-1z",
  };
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] ?? "M4 12h16"} />
    </svg>
  );
}

export function NavLinks({ isOwner, badges }: { isOwner: boolean; badges: NavBadges }) {
  const pathname = usePathname();

  function render(items: Item[]) {
    return items
      .filter((l) => isOwner || !l.ownerOnly)
      .map((link) => {
        const base = link.href.split("?")[0];
        const active = link.exact ? pathname === link.href : pathname.startsWith(base) && !link.href.includes("?");
        const count = link.badge ? badges[link.badge] : 0;
        const className = `flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
          link.soon
            ? "cursor-default text-slate-500"
            : active
              ? "bg-white/10 text-white"
              : "text-slate-300 hover:bg-white/5 hover:text-white"
        }`;
        const content = (
          <>
            <Icon name={link.href} />
            <span className="flex-1">{link.label}</span>
            {link.tag && (
              <span className="rounded bg-brand-700/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-brand-50 uppercase">
                {link.tag}
              </span>
            )}
            {count > 0 && (
              <span className="min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[11px] font-semibold text-white">
                {count}
              </span>
            )}
          </>
        );
        return link.soon ? (
          <span key={link.href} className={className} title="Disponible dans une prochaine version">
            {content}
          </span>
        ) : (
          <Link key={link.href} href={link.href} className={className}>
            {content}
          </Link>
        );
      });
  }

  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3 lg:pb-0">
      {render(MAIN)}
      <p className="mt-4 mb-1 hidden px-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase lg:block">
        Gestion
      </p>
      {render(GESTION)}
    </nav>
  );
}
