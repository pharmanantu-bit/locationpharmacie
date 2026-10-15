// Modèle de conditions générales repris sur le contrat de location quand la
// pharmacie n'a pas saisi les siennes dans les paramètres.
//
// ⚠ Ce texte est un point de départ générique : il doit être relu et validé
// par un conseil juridique avant toute utilisation réelle (mentions sur
// l'empreinte bancaire, RGPD, responsabilité).
//
// Format : une ligne commençant par « # » = titre d'article ; les paragraphes
// sont séparés par une ligne vide.

export const DEFAULT_CONTRACT_TERMS = `# Article 1 – Objet
La pharmacie (le loueur) met à disposition du patient (le locataire) le matériel médical désigné ci-dessus, en bon état de fonctionnement, propre et désinfecté, accompagné de sa notice d'utilisation.

# Article 2 – Durée et renouvellement
La location prend effet à la date de remise du matériel pour la durée indiquée ci-dessus, dans la limite de la prescription médicale. Elle se poursuit par périodes successives tant que le matériel n'est pas restitué, sous réserve d'une ordonnance valable. Le locataire s'engage à fournir une nouvelle ordonnance avant l'expiration de la précédente si la location doit se poursuivre.

# Article 3 – Prix et facturation
Le prix de la location est celui indiqué ci-dessus, facturé par période selon la périodicité convenue. Les sommes prises en charge par l'Assurance Maladie et la complémentaire santé sont déduites selon les règles en vigueur ; le reste à charge éventuel est réglé par le locataire à la pharmacie.

# Article 4 – Caution par empreinte bancaire
Une caution d'un montant indiqué ci-dessus garantit la restitution du matériel en bon état. Elle est constituée par une empreinte de carte bancaire enregistrée auprès d'un prestataire de paiement sécurisé ; aucune somme n'est prélevée lors de la mise en place. En cas de non-restitution, de perte, de vol ou de dommage non imputable à l'usure normale, le loueur pourra, après en avoir informé le locataire, prélever tout ou partie de la caution dans la limite du montant convenu et du coût de remise en état ou de remplacement.

# Article 5 – Utilisation et entretien
Le locataire s'engage à utiliser le matériel conformément à la notice et à la prescription, pour son usage personnel, à ne pas le prêter, le sous-louer ni le céder, et à le maintenir en bon état de propreté. Toute panne ou anomalie doit être signalée sans délai à la pharmacie ; le locataire ne doit pas tenter de réparer le matériel lui-même.

# Article 6 – Restitution
À la fin de la location, le matériel est restitué à la pharmacie, complet, propre et dans l'état où il a été remis, usure normale exceptée. Un état du matériel est réalisé lors de la restitution. Tout retard de restitution entraîne la facturation des périodes supplémentaires.

# Article 7 – Responsabilité
Le locataire est responsable du matériel dès sa remise et jusqu'à sa restitution. Il lui appartient de vérifier que son assurance couvre les biens loués. Le loueur ne saurait être tenu responsable des dommages résultant d'une utilisation non conforme à la notice ou à la prescription.

# Article 8 – Données personnelles
Les informations recueillies sont traitées par la pharmacie pour la gestion de la location (dossier, ordonnance, caution, rappels) et conservées pendant la durée légale applicable. Conformément au RGPD, le locataire dispose d'un droit d'accès, de rectification, d'effacement et d'opposition, qu'il peut exercer auprès de la pharmacie. Les rappels par SMS ne sont envoyés qu'avec son accord.

# Article 9 – Litiges
Le présent contrat est soumis au droit français. En cas de désaccord, les parties rechercheront une solution amiable avant toute action judiciaire.`;

export type TermsBlock = { kind: "heading" | "paragraph"; text: string };

// Découpe le texte des conditions en titres et paragraphes
export function parseTerms(source: string): TermsBlock[] {
  const blocks: TermsBlock[] = [];
  for (const raw of source.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const chunk = raw.trim();
    if (!chunk) continue;
    let paragraph: string[] = [];
    const flush = () => {
      if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    };
    for (const line of chunk.split("\n")) {
      if (line.startsWith("# ")) {
        flush();
        blocks.push({ kind: "heading", text: line.slice(2).trim() });
      } else {
        paragraph.push(line.trim());
      }
    }
    flush();
  }
  return blocks;
}
