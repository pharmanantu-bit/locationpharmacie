// Catalogue de matériel commun à toutes les pharmacies.
// Chaque pharmacie rattache ses propres types (EquipmentType) à une entrée du catalogue :
// c'est ce rattachement qui permettra l'annuaire public ("qui loue un tire-lait près de chez moi ?")
// et, plus tard, les commandes fournisseurs.

export type CatalogueEntry = { slug: string; name: string; category: string };

export const CATALOGUE: CatalogueEntry[] = [
  { slug: "tire-lait", name: "Tire-lait", category: "Maternité" },
  { slug: "pese-bebe", name: "Pèse-bébé", category: "Maternité" },
  { slug: "aerosol", name: "Aérosol / nébuliseur", category: "Respiratoire" },
  { slug: "lit-medicalise", name: "Lit médicalisé", category: "Lit et confort" },
  { slug: "matelas-anti-escarres", name: "Matelas anti-escarres", category: "Lit et confort" },
  { slug: "potence", name: "Potence de lit", category: "Lit et confort" },
  { slug: "fauteuil-releveur", name: "Fauteuil releveur", category: "Lit et confort" },
  { slug: "fauteuil-roulant", name: "Fauteuil roulant", category: "Mobilité" },
  { slug: "deambulateur", name: "Déambulateur / rollator", category: "Mobilité" },
  { slug: "bequilles", name: "Béquilles / cannes anglaises", category: "Mobilité" },
  { slug: "leve-personne", name: "Lève-personne", category: "Mobilité" },
  { slug: "chaise-garde-robe", name: "Chaise garde-robe", category: "Hygiène" },
  { slug: "chaise-de-douche", name: "Chaise / siège de douche", category: "Hygiène" },
  { slug: "tens", name: "Neurostimulateur (TENS)", category: "Antalgie" },
  { slug: "attelle-cryotherapie", name: "Attelle de cryothérapie", category: "Antalgie" },
  { slug: "tensiometre", name: "Tensiomètre (MAPA)", category: "Mesure" },
];

// Types créés par défaut à l'inscription d'une pharmacie (slugs du catalogue)
export const DEFAULT_TYPE_SLUGS = [
  "tire-lait",
  "aerosol",
  "deambulateur",
  "fauteuil-roulant",
  "lit-medicalise",
  "tens",
  "bequilles",
];
