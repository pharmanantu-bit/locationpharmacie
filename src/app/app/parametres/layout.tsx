import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { SettingsNav } from "./settings-nav";

export const metadata: Metadata = { title: "Réglages" };

export default async function SettingsLayout({ children }: LayoutProps<"/app/parametres">) {
  await requireOwner();
  return (
    <>
      <PageHeader
        title="Réglages"
        subtitle="Votre pharmacie, et les préférences qui adaptent locationenpharmacie à votre façon de travailler."
      />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-start">
        <SettingsNav />
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </>
  );
}
