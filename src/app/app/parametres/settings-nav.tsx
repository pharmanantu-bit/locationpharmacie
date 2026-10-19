"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string; exact?: boolean; children?: { href: string; label: string }[] };

const ITEMS: Item[] = [
  { href: "/app/parametres", label: "Pharmacie", icon: "pharmacy", exact: true },
  {
    href: "/app/parametres/preferences",
    label: "Préférences",
    icon: "sliders",
    children: [
      { href: "/app/parametres/preferences#types", label: "Types de matériel" },
      { href: "/app/parametres/preferences#contrat", label: "Contrat de location" },
    ],
  },
  { href: "/app/parametres/acces", label: "Accès", icon: "key" },
  { href: "/app/parametres/empreinte-bancaire", label: "Empreinte bancaire", icon: "card" },
  { href: "/app/parametres/abonnement", label: "Abonnement", icon: "receipt" },
];

const ICONS: Record<string, string> = {
  pharmacy: "M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M3 21h18M9 7h6M9 11h6M9 15h6",
  sliders: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6",
  key: "M15 7a4 4 0 1 1-2.6 7.1L8 18.5V21H4v-4l6.5-6.5A4 4 0 0 1 15 7z",
  card: "M3 7h18v10H3zM3 11h18M7 15h3",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
};

function Icon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections des réglages" className="flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <div key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon name={item.icon} />
              <span className="flex-1 whitespace-nowrap">{item.label}</span>
              {item.children && (
                <svg
                  viewBox="0 0 24 24"
                  className={`size-4 text-slate-400 transition ${active ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              )}
            </Link>
            {item.children && active && (
              <div className="hidden lg:block">
                {item.children.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="block rounded-lg py-1.5 pr-3 pl-11 text-sm text-slate-500 hover:text-slate-900"
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
