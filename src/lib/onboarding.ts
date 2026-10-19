import "server-only";
import { db } from "./db";
import { isStripeConfigured } from "./stripe";

// Guide « Bien démarrer » : dix étapes en trois temps (paramétrer, essayer,
// lancer). La plupart sont déduites des données ; quelques-unes se cochent à
// la main et sont mémorisées dans Pharmacy.onboardingDone.

export type OnboardingGroup = "setup" | "try" | "launch";

export const GROUP_LABELS: Record<OnboardingGroup, string> = {
  setup: "1. Paramétrer",
  try: "2. Essayer",
  launch: "3. Lancer",
};

export type OnboardingStep = {
  key: string;
  group: OnboardingGroup;
  title: string;
  description: string;
  href: string;
  cta: string;
  manual: boolean;
  done: boolean;
  ownerOnly?: boolean;
};

export const MANUAL_STEPS = ["contract-terms", "counter-posts", "inform-team"] as const;

export type OnboardingProgress = { steps: OnboardingStep[]; done: number; total: number; next: OnboardingStep | null };

export async function getOnboarding(pharmacyId: string): Promise<OnboardingProgress> {
  const [pharmacy, members, types, equipmentCount, rentalCount, contractCount] = await Promise.all([
    db.pharmacy.findUniqueOrThrow({
      where: { id: pharmacyId },
      select: { address: true, phone: true, stripeAccountId: true, onboardingDone: true },
    }),
    db.user.count({ where: { pharmacyId } }),
    db.equipmentType.findMany({
      where: { pharmacyId, archived: false },
      select: { priceCents: true, depositCents: true },
    }),
    db.equipment.count({ where: { pharmacyId } }),
    db.rental.count({ where: { pharmacyId } }),
    db.document.count({ where: { pharmacyId, kind: "CONTRACT" } }),
  ]);
  const manual = new Set(pharmacy.onboardingDone);
  const stripeReady = isStripeConfigured();

  const steps: OnboardingStep[] = [
    {
      key: "pharmacy-info",
      group: "setup",
      title: "Informations de la pharmacie",
      description: "Adresse, téléphone et e-mail figurent en en-tête des contrats remis aux patients.",
      href: "/app/parametres",
      cta: "Compléter",
      manual: false,
      done: !!pharmacy.address && !!pharmacy.phone,
      ownerOnly: true,
    },
    {
      key: "team",
      group: "setup",
      title: "Ajoutez votre équipe",
      description:
        "Chaque membre a son propre accès : les actions sont tracées à son nom dans l'historique des dossiers.",
      href: "/app/parametres#operateurs",
      cta: "Ajouter un membre",
      manual: false,
      done: members > 1,
      ownerOnly: true,
    },
    {
      key: "types-tarifs",
      group: "setup",
      title: "Définissez vos tarifs par défaut",
      description:
        "Pour chaque type de matériel : périodicité de facturation, durée habituelle, tarif et caution. Ils pré-remplissent chaque nouveau dossier et le contrat.",
      href: "/app/parametres/preferences#types",
      cta: "Régler les tarifs",
      manual: false,
      done: types.some((t) => t.priceCents != null && t.depositCents != null),
      ownerOnly: true,
    },
    {
      key: "parc",
      group: "setup",
      title: "Votre parc de matériel",
      description:
        "Enregistrez les appareils que vous possédez (modèle, numéro de série, date d'achat). Leur historique de vie commence ici.",
      href: "/app/parc/nouveau",
      cta: "Ajouter un appareil",
      manual: false,
      done: equipmentCount > 0,
    },
    {
      key: "contract-terms",
      group: "setup",
      title: "Relisez les conditions du contrat",
      description:
        "Un modèle de conditions générales est fourni. Faites-le relire par votre conseil juridique, adaptez-le si besoin et renseignez votre SIRET.",
      href: "/app/parametres/preferences#contrat",
      cta: "Vérifier",
      manual: true,
      done: manual.has("contract-terms"),
      ownerOnly: true,
    },
    {
      key: "stripe",
      group: "setup",
      title: "Activez l'empreinte bancaire",
      description: stripeReady
        ? "Le patient enregistre sa carte lui-même : plus de chèque de caution. Connectez votre compte Stripe en quelques minutes."
        : "Le patient enregistrera sa carte lui-même : plus de chèque de caution. Disponible dès que la clé Stripe de la plateforme sera configurée.",
      href: "/app/parametres/empreinte-bancaire",
      cta: "Connecter Stripe",
      manual: false,
      done: !!pharmacy.stripeAccountId,
      ownerOnly: true,
    },
    {
      key: "first-rental",
      group: "try",
      title: "Faites un premier dossier",
      description:
        "Créez un dossier de test : patient, source du matériel, ordonnance. Vous pourrez l'annuler ensuite.",
      href: "/app/dossiers/nouveau",
      cta: "Nouveau dossier",
      manual: false,
      done: rentalCount > 0,
    },
    {
      key: "first-contract",
      group: "try",
      title: "Générez un contrat",
      description:
        "Depuis la fiche du dossier, générez le contrat PDF pré-rempli et vérifiez le rendu avant de l'imprimer pour un vrai patient.",
      href: "/app/dossiers",
      cta: "Ouvrir les dossiers",
      manual: false,
      done: contractCount > 0,
    },
    {
      key: "counter-posts",
      group: "launch",
      title: "Préparez les postes du comptoir",
      description:
        "Ajoutez l'application aux favoris de chaque poste et connectez chaque opérateur avec son propre accès.",
      href: "/app",
      cta: "Ouvrir le tableau de bord",
      manual: true,
      done: manual.has("counter-posts"),
    },
    {
      key: "inform-team",
      group: "launch",
      title: "Prévenez votre équipe",
      description:
        "Présentez le parcours en six étapes : patient, source, ordonnance, caution, contrat, suivi. Un dossier se crée en moins de deux minutes.",
      href: "/app/dossiers/nouveau",
      cta: "Voir le parcours",
      manual: true,
      done: manual.has("inform-team"),
    },
  ];

  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, next: steps.find((s) => !s.done) ?? null };
}
