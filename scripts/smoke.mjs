// Test de bout en bout du parcours principal.
// Usage : node scripts/smoke.mjs [baseUrl] [dossierCaptures]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3100";
const SHOTS = process.argv[3];
const stamp = Date.now();

// Un PDF minimal mais valide, pour l'ordonnance
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\n0000000000 65535 f \n" +
    "0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n160\n%%EOF\n",
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function shot(name) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}
function check(cond, msg) {
  if (!cond) throw new Error(`ÉCHEC : ${msg}`);
  console.log(`ok - ${msg}`);
}
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

async function signup(pharmacy, email) {
  await page.goto(`${BASE}/inscription`);
  await page.fill('[name="pharmacyName"]', pharmacy);
  await page.fill('[name="city"]', "Nantua");
  await page.fill('[name="name"]', "Camille Martin");
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', "motdepasse-test-123");
  await page.click("text=Créer le compte");
  await page.waitForURL(`${BASE}/app`);
}

try {
  await page.goto(BASE);
  await shot("01-accueil");

  await signup("Pharmacie Test", `test-${stamp}@example.com`);
  check(await page.isVisible("text=Aucune location en cours"), "inscription puis tableau de bord vide");
  check(await page.isVisible("text=0 sur 10"), "guide Bien démarrer : 0 sur 10 au départ");

  // Paramètres : durée et caution par défaut du tire-lait, rattaché au catalogue commun
  await page.goto(`${BASE}/app/parametres/preferences`);
  const row = page.locator("form", { has: page.locator('input[name="name"][value="Tire-lait"]') });
  check((await row.locator('[name="catalogueId"] option:checked').textContent()) === "Tire-lait", "type par défaut rattaché au catalogue");
  await row.locator('[name="defaultDurationDays"]').fill("28");
  await row.locator('[name="price"]').fill("12,50");
  await row.locator('[name="deposit"]').fill("150");
  await row.locator("text=Enregistrer").click();
  await page.waitForLoadState("networkidle");

  // Parc : ajout d'un appareil
  await page.goto(`${BASE}/app/parc/nouveau`);
  await page.selectOption('[name="typeId"]', { label: "Tire-lait" });
  await page.fill('[name="label"]', "Medela Symphony #1");
  await page.fill('[name="serialNumber"]', "SN-0001");
  await page.fill('[name="purchaseDate"]', "2025-01-15");
  await page.click("text=Ajouter au parc");
  await page.waitForURL(/\/app\/parc\/c/);
  const equipmentUrl = page.url();
  check(await page.isVisible("text=Disponible"), "appareil ajouté et disponible");
  check(await page.isVisible("text=Entrée au parc"), "historique de vie : entrée au parc");

  // Nouveau dossier en étapes : patient + matériel → source → ordonnance → récap
  await page.goto(`${BASE}/app/dossiers/nouveau`);
  await page.fill('[name="patientLastName"]', "Dupont");
  await page.fill('[name="patientFirstName"]', "Marie");
  await page.fill('[name="patientPhone"]', "0601020304");
  await page.check('[name="smsConsent"]');
  await page.selectOption('[name="typeId"]', { label: "Tire-lait" });
  check((await page.inputValue('[name="deposit"]')) === "150", "caution par défaut reprise du type");
  check((await page.inputValue('[name="price"]')) === "12.5", "tarif par défaut repris du type");
  check((await page.inputValue('[name="prescriptionDurationDays"]')) === "28", "durée par défaut reprise du type");
  await page.click("button:has-text('Suivant')");
  check(await page.isVisible("text=D'où vient le matériel"), "étape 2 : source du matériel");
  await page.selectOption('[name="equipmentId"]', { label: "Medela Symphony #1 — n° SN-0001" });
  await page.click("button:has-text('Suivant')");
  check(await page.isVisible("text=Ordonnance et durée"), "étape 3 : ordonnance");
  await page.setInputFiles('[name="prescriptionFile"]', { name: "ordonnance.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.fill('[name="prescriber"]', "Dr Morel");
  // Ordonnance et remise il y a 40 jours : ordonnance expirée (28 j), location en retard et à facturer
  await page.fill('[name="prescriptionDate"]', daysAgo(40));
  await page.fill('[name="startDate"]', daysAgo(40));
  check((await page.inputValue('[name="plannedEndDate"]')) === daysAgo(12), "fin prévue = début + durée prescrite");
  await shot("02-nouveau-dossier");
  await page.click("button:has-text('Vérifier')");
  check(await page.isVisible("text=Récapitulatif"), "récapitulatif avant création");
  check(await page.isVisible("text=ordonnance.pdf"), "récapitulatif : fichier d'ordonnance listé");
  await page.click("button:has-text('Créer le dossier')", { noWaitAfter: true });
  await page.waitForURL(/\/app\/dossiers\/c/);
  const rentalUrl = page.url();
  check(await page.isVisible("h1:has-text('LOC-')"), "dossier créé avec un numéro");
  check(await page.locator("text=En retard").first().isVisible(), "dossier signalé en retard");
  check(await page.locator("text=À facturer").first().isVisible(), "dossier signalé à facturer");
  check(await page.locator("text=Ordonnance expirée").first().isVisible(), "ordonnance signalée expirée");
  check(await page.isVisible("text=Ordonnance jointe (ordonnance.pdf)"), "ordonnance tracée dans l'historique");
  check(await page.isVisible("text=Accepte les SMS de suivi"), "consentement SMS enregistré");
  await shot("03-dossier");

  // Lecture du document : réservée à la pharmacie, servie en PDF
  const docHref = await page.locator('a[href^="/app/documents/"]').first().getAttribute("href");
  const docRes = await page.request.get(`${BASE}${docHref}`);
  check(docRes.status() === 200 && docRes.headers()["content-type"] === "application/pdf", "ordonnance téléchargeable en PDF");

  // Étape 5 : contrat PDF pré-rempli, conservé avec le dossier
  check(await page.isVisible("text=Aucun contrat généré"), "contrat : rien de généré au départ");
  await page.click("button:has-text('Générer le contrat')");
  await page.waitForSelector("text=Contrat généré (contrat-LOC-");
  check(await page.isVisible("button:has-text('Régénérer le contrat')"), "contrat généré, régénération proposée");
  const contractHref = await page.locator('a[href^="/app/documents/"]:has-text("contrat-LOC-")').first().getAttribute("href");
  const contractRes = await page.request.get(`${BASE}${contractHref}`);
  const contractBody = await contractRes.body();
  check(
    contractRes.status() === 200 && contractRes.headers()["content-type"] === "application/pdf" && contractBody.subarray(0, 4).toString() === "%PDF",
    `contrat téléchargeable en PDF (${Math.round(contractBody.length / 1024)} Ko)`,
  );
  check(await page.isVisible("text=à faire signer"), "parcours : étape contrat validée");
  await shot("03b-contrat");

  await page.click("text=J'ai facturé dans le LGO");
  await page.waitForSelector("text=Période facturée dans le LGO");
  check(true, "période facturée tracée dans l'historique");

  await page.goto(`${BASE}/app`);
  await shot("04-tableau-de-bord");
  check(await page.isVisible("text=En retard de restitution"), "tableau de bord : section retard");
  check(await page.isVisible("text=Ordonnance expirée ou expirant"), "tableau de bord : section ordonnances");

  // Retour du matériel puis clôture
  await page.goto(rentalUrl);
  await page.fill('[name="condition"]', "Bon état");
  await page.click("text=Enregistrer le retour");
  await page.waitForSelector("text=Clôturer le dossier");
  check(await page.isVisible("text=À clôturer"), "retour enregistré, dossier à clôturer");
  page.once("dialog", (d) => d.accept());
  await page.click("button:has-text('Clôturer le dossier')");
  await page.waitForSelector("text=Dossier clôturé");
  check(await page.locator("text=Clôturé").first().isVisible(), "dossier clôturé");

  // Parc : l'appareil est à nettoyer, puis redevient disponible après désinfection
  await page.goto(equipmentUrl);
  check(await page.locator("span:has-text('En nettoyage')").first().isVisible(), "appareil passé en nettoyage après retour");
  check(await page.isVisible("text=Retour du patient"), "historique de vie : retour tracé");
  await page.click("text=Nettoyé et désinfecté");
  await page.waitForSelector("span:has-text('Disponible')");
  check(await page.isVisible("text=Nettoyage / désinfection"), "historique de vie : nettoyage tracé");
  await shot("05-appareil");

  // Guide Bien démarrer : étapes déduites des données + étape cochée à la main
  await page.goto(`${BASE}/app/bien-demarrer`);
  check(await page.isVisible("text=4 sur 10"), "guide : tarifs, parc, dossier et contrat détectés (4 sur 10)");
  await page.click("details:has-text('Prévenez votre équipe') summary");
  await page.click("details:has-text('Prévenez votre équipe') button:has-text('Marquer comme fait')");
  await page.waitForSelector("text=5 sur 10");
  check(await page.isVisible("text=5 sur 10"), "guide : étape manuelle cochée (5 sur 10)");
  await shot("06-bien-demarrer");

  // Cloisonnement : une autre pharmacie ne voit ni le dossier ni l'ordonnance
  await page.context().clearCookies();
  await signup("Autre Pharmacie", `autre-${stamp}@example.com`);
  const res = await page.goto(rentalUrl);
  check(res.status() === 404, "dossier d'une autre pharmacie inaccessible (404)");
  const otherDoc = await page.request.get(`${BASE}${docHref}`);
  check(otherDoc.status() === 404, "ordonnance d'une autre pharmacie inaccessible (404)");

  check(errors.length === 0, `aucune erreur JavaScript (${errors.join(" | ")})`);
  console.log("\nTous les tests sont passés.");
} catch (e) {
  console.error(e.message);
  await shot("echec");
  process.exitCode = 1;
} finally {
  await browser.close();
}
