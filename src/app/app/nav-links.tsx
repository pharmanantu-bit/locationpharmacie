"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/app", label: "Tableau de bord", exact: true },
  { href: "/app/dossiers", label: "Dossiers" },
  { href: "/app/parc", label: "Parc de matériel" },
  { href: "/app/patients", label: "Patients" },
  { href: "/app/parametres", label: "Paramètres", ownerOnly: true },
];

export function NavLinks({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3 lg:pb-0">
      {LINKS.filter((l) => isOwner || !l.ownerOnly).map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
