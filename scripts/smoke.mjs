// Test de bout en bout du parcours principal.
// Usage : node scripts/smoke.mjs [baseUrl] [dossierCaptures]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3100";
const SHOTS = process.argv[3];
const stamp = Date.now();

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

  // Paramètres : durée et caution par défaut du tire-lait
  await page.goto(`${BASE}/app/parametres`);
  const row = page.locator("form", { has: page.locator('input[name="name"][value="Tire-lait"]') });
  await row.locator('[name="defaultDurationDays"]').fill("28");
  await row.locator('[name="deposit"]').fill("150");
  await row.locator("text=Enregistrer").click();
  await page.waitForLoadState("networkidle");

  // Parc : ajout d'un appareil
  await page.goto(`${BASE}/app/parc/nouveau`);
  await page.selectOption('[name="typeId"]', { label: "Tire-lait" });
  await page.fill('[name="label"]', "Medela Symphony #1");
  await page.fill('[name="serialNumber"]', "SN-0001");
  await page.click("text=Ajouter au parc");
  await page.waitForURL(/\/app\/parc\/c/);
  check(await page.isVisible("text=Disponible"), "appareil ajouté et disponible");

  // Nouveau dossier avec nouveau patient, remis il y a 40 jours => en retard et à facturer
  await page.goto(`${BASE}/app/dossiers/nouveau`);
  await page.fill('[name="patientLastName"]', "Dupont");
  await page.fill('[name="patientFirstName"]', "Marie");
  await page.fill('[name="patientPhone"]', "0601020304");
  await page.selectOption('[name="typeId"]', { label: "Tire-lait" });
  check((await page.inputValue('[name="deposit"]')) === "150", "caution par défaut reprise du type");
  await page.selectOption('[name="equipmentId"]', { label: "Medela Symphony #1 — n° SN-0001" });
  const start = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
  await page.fill('[name="startDate"]', start);
  await page.fill('[name="prescriber"]', "Dr Morel");
  await page.fill('[name="deliveryNoteNumber"]', "BL-778899");
  await shot("02-nouveau-dossier");
  await page.click("text=Créer le dossier");
  await page.waitForURL(/\/app\/dossiers\/c/);
  const rentalUrl = page.url();
  check(await page.isVisible("h1:has-text('LOC-')"), "dossier créé avec un numéro");
  check(await page.locator("text=En retard").first().isVisible(), "dossier signalé en retard");
  check(await page.locator("text=À facturer").first().isVisible(), "dossier signalé à facturer");
  await shot("03-dossier");

  await page.click("text=J'ai facturé dans le LGO");
  await page.waitForLoadState("networkidle");
  check(await page.isVisible("text=Période facturée dans le LGO"), "période facturée tracée dans l'historique");

  await page.goto(`${BASE}/app`);
  await shot("04-tableau-de-bord");
  check(await page.isVisible("text=En retard de restitution"), "tableau de bord : section retard");

  // Retour du matériel puis clôture
  await page.goto(rentalUrl);
  await page.click("text=Enregistrer le retour");
  await page.waitForSelector("text=Clôturer le dossier");
  check(await page.isVisible("text=À clôturer"), "retour enregistré, dossier à clôturer");
  page.once("dialog", (d) => d.accept());
  await page.click("button:has-text('Clôturer le dossier')");
  await page.waitForSelector("text=Dossier clôturé");
  check(await page.locator("text=Clôturé").first().isVisible(), "dossier clôturé");

  await page.goto(`${BASE}/app/parc`);
  await page.selectOption('[name="statut"]', "");
  check(await page.isVisible("span:has-text('Nettoyage / révision')"), "appareil passé en nettoyage après retour");

  // Cloisonnement : une autre pharmacie ne voit pas ce dossier
  await page.context().clearCookies();
  await signup("Autre Pharmacie", `autre-${stamp}@example.com`);
  const res = await page.goto(rentalUrl);
  check(res.status() === 404, "dossier d'une autre pharmacie inaccessible (404)");

  check(errors.length === 0, `aucune erreur JavaScript (${errors.join(" | ")})`);
  console.log("\nTous les tests sont passés.");
} catch (e) {
  console.error(e.message);
  await shot("echec");
  process.exitCode = 1;
} finally {
  await browser.close();
}
