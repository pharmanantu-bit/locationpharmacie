# locationenpharmacie.com

Suivi des locations de matériel médical pour les pharmacies d'officine (multi-pharmacies).

Next.js 16 · Prisma 6 · PostgreSQL · Tailwind 4

## Lancer en local

```bash
npm install
npx prisma dev -n lep        # base PostgreSQL locale (laisser tourner dans un terminal)
npx prisma migrate dev       # crée / met à jour les tables
npm run dev -- -p 3100       # http://localhost:3100
```

Test de bout en bout (serveur lancé) : `node scripts/smoke.mjs`

## Feuille de route

Cahier des charges : outil de gestion de la location de matériel médical pour pharmacies (notes Airlok du 15/10/2026).
Choix validés : Stripe Connect (un compte par pharmacie), SMS via Brevo, catalogue commun + types locaux.

1. **Socle** : comptes pharmacie et équipe, dossiers, parc, patients, alertes de retard et de facturation ✅
2. **Parcours en 6 étapes + ordonnance** : patient et matériel → source (parc / fournisseur) → ordonnance
   (PDF ou photo, durée, date d'expiration) → récapitulatif ; catalogue commun ; historique de vie et
   nettoyage des appareils ; consentement SMS ; journal d'audit ✅
3. Contrat PDF pré-rempli (`Document` kind=CONTRACT)
4. Caution par empreinte bancaire : Stripe Connect + SetupIntent, lien / QR code envoyé au patient, débit partiel (`Deposit`)
5. Rappels SMS automatiques via Brevo, file d'envoi avec reprise (`Notification`)
6. Annuaire public temps réel (`CatalogueItem`, `Pharmacy.publicListing`)
7. Facturation des pharmacies : 5 € par nouveau dossier puis abonnement (`Pharmacy.plan`)

Hors MVP (prévu dans le schéma) : contrôle des factures fournisseurs par n° de BL, commandes fournisseurs, API LGO.

## Fichiers (ordonnances, contrats)

`src/lib/storage.ts` : disque local (`./storage`, ignoré par git) en développement via `STORAGE_DRIVER=local` ;
bucket S3 compatible chez l'hébergeur HDS en production (`STORAGE_DRIVER=s3`, à brancher au déploiement).
Les documents sont servis par `/app/documents/[id]` après vérification de la pharmacie, et chaque lecture est
tracée dans `AuditLog`.

## Production

Données de santé : hébergement obligatoirement **certifié HDS** (ex. Clever Cloud, Scaleway, OVHcloud).
Ne pas déployer sur Vercel / Neon avec de vraies données patients.
