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

1. **Socle** : comptes pharmacie et équipe, dossiers, parc, patients, alertes de retard et de facturation ✅
2. SMS de rappel de fin de contrat
3. Contrat PDF pré-rempli et signature au comptoir
4. Caution par empreinte bancaire (Stripe Connect)
5. Contrôle des factures fournisseurs par IA (rapprochement par n° de BL)
6. Facturation des pharmacies clientes, inscription publique, annuaire

## Production

Données de santé : hébergement obligatoirement **certifié HDS** (ex. Clever Cloud, Scaleway, OVHcloud).
Ne pas déployer sur Vercel / Neon avec de vraies données patients.
