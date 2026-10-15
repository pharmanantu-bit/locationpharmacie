import "server-only";
import type { BillingPeriod, Equipment, EquipmentType, Patient, Pharmacy, Rental } from "@prisma/client";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import { DEFAULT_CONTRACT_TERMS, parseTerms } from "./contract-terms";
import { formatDay, formatEuros, formatLongDay, todayUTC } from "./dates";
import { SOURCE_LABELS } from "./rentals";

// Contrat de location (étape 5 du parcours) : PDF A4 pré-rempli avec les
// informations de la pharmacie, du patient, du matériel et de l'ordonnance,
// suivi des conditions générales et d'un cadre de signatures.

export type ContractInput = {
  rental: Rental;
  pharmacy: Pharmacy;
  patient: Patient;
  type: EquipmentType;
  equipment: Equipment | null;
};

const PAGE = { width: 595.28, height: 841.89 }; // A4 en points
const MARGIN = 50;
const CONTENT_WIDTH = PAGE.width - 2 * MARGIN;
const INK = rgb(0.1, 0.12, 0.16);
const MUTED = rgb(0.4, 0.44, 0.5);
const RULE = rgb(0.82, 0.85, 0.88);

const PRICE_SUFFIX: Record<BillingPeriod, string> = {
  WEEKLY: "par semaine",
  MONTHLY: "par mois",
  ONE_OFF: "forfait pour la durée de la location",
};

// Les polices standard du PDF n'encodent que le jeu WinAnsi : on remplace les
// caractères hors de ce jeu pour ne jamais faire échouer la génération.
const WINANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
function sanitize(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0)!;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WINANSI_EXTRA.has(ch)) out += ch;
    else if (ch === "→") out += "-";
    else if (ch === "\n" || ch === "\t") out += " ";
    else out += "?";
  }
  return out;
}

type Color = ReturnType<typeof rgb>;

class Writer {
  private page!: PDFPage;
  private y = 0;
  private readonly pages: PDFPage[] = [];

  constructor(
    private readonly doc: PDFDocument,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
  ) {
    this.newPage();
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.pages.push(this.page);
    this.y = PAGE.height - MARGIN;
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN + 24) this.newPage();
  }

  private wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) {
          line = candidate;
        } else {
          if (line) lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  space(points: number) {
    this.y -= points;
  }

  text(
    raw: string,
    opts: { size?: number; bold?: boolean; color?: Color; x?: number; width?: number; lineHeight?: number } = {},
  ) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.font;
    const x = opts.x ?? MARGIN;
    const width = opts.width ?? CONTENT_WIDTH - (x - MARGIN);
    const lineHeight = opts.lineHeight ?? size * 1.4;
    for (const line of this.wrap(sanitize(raw), font, size, width)) {
      this.ensure(lineHeight);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= lineHeight;
    }
  }

  heading(raw: string) {
    this.ensure(30);
    this.space(8);
    this.text(raw, { size: 11.5, bold: true });
    this.page.drawLine({
      start: { x: MARGIN, y: this.y + 2 },
      end: { x: MARGIN + CONTENT_WIDTH, y: this.y + 2 },
      thickness: 0.6,
      color: RULE,
    });
    this.space(6);
  }

  // Lignes « libellé : valeur » sur deux colonnes
  rows(items: [string, string][], labelWidth = 130) {
    const size = 10;
    for (const [label, value] of items) {
      const lines = this.wrap(sanitize(value), this.bold, size, CONTENT_WIDTH - labelWidth);
      this.ensure(lines.length * size * 1.4);
      this.page.drawText(sanitize(label), { x: MARGIN, y: this.y - size, size, font: this.font, color: MUTED });
      for (const line of lines) {
        this.page.drawText(line, { x: MARGIN + labelWidth, y: this.y - size, size, font: this.bold, color: INK });
        this.y -= size * 1.4;
      }
    }
  }

  // Deux cadres de signature côte à côte
  signatures(left: string[], right: string[]) {
    const height = 110;
    this.ensure(height + 20);
    const gap = 16;
    const width = (CONTENT_WIDTH - gap) / 2;
    const top = this.y;
    [left, right].forEach((lines, i) => {
      const x = MARGIN + i * (width + gap);
      this.page.drawRectangle({ x, y: top - height, width, height, borderColor: RULE, borderWidth: 0.8 });
      let y = top - 14;
      lines.forEach((line, j) => {
        const size = j === 0 ? 10 : 8.5;
        const font = j === 0 ? this.bold : this.font;
        for (const l of this.wrap(sanitize(line), font, size, width - 20)) {
          this.page.drawText(l, { x: x + 10, y: y - size, size, font, color: j === 0 ? INK : MUTED });
          y -= size * 1.5;
        }
      });
    });
    this.y = top - height;
  }

  finish(footer: string) {
    const n = this.pages.length;
    this.pages.forEach((page, i) => {
      const label = sanitize(`${footer} — page ${i + 1}/${n}`);
      const size = 8;
      page.drawText(label, {
        x: PAGE.width - MARGIN - this.font.widthOfTextAtSize(label, size),
        y: MARGIN - 20,
        size,
        font: this.font,
        color: MUTED,
      });
    });
  }
}

function pharmacyAddress(p: Pharmacy): string {
  const line2 = [p.postalCode, p.city].filter(Boolean).join(" ");
  return [p.address, line2].filter(Boolean).join(", ");
}

function patientName(p: Patient): string {
  return `${p.lastName.toUpperCase()} ${p.firstName}`;
}

export async function buildContractPdf({ rental, pharmacy, patient, type, equipment }: ContractInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Contrat de location ${rental.number}`);
  doc.setAuthor(pharmacy.name);
  doc.setProducer("locationenpharmacie.com");
  doc.setCreationDate(new Date());
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold);
  const today = todayUTC();

  // En-tête : pharmacie
  w.text(pharmacy.name, { size: 13, bold: true });
  const contact = [pharmacyAddress(pharmacy), pharmacy.phone, pharmacy.email].filter(Boolean).join(" · ");
  if (contact) w.text(contact, { size: 9, color: MUTED });
  if (pharmacy.siret) w.text(`SIRET ${pharmacy.siret}`, { size: 9, color: MUTED });
  w.space(18);

  w.text("CONTRAT DE LOCATION DE MATÉRIEL MÉDICAL", { size: 16, bold: true });
  w.text(`Dossier n° ${rental.number} · établi le ${formatDay(today)}`, { size: 10, color: MUTED });
  w.space(6);

  w.heading("Entre les soussignés");
  w.rows([
    ["Le loueur", [pharmacy.name, pharmacyAddress(pharmacy)].filter(Boolean).join(", ")],
    ["Le locataire", [patientName(patient), patient.address, patient.phone, patient.email].filter(Boolean).join(", ")],
  ]);

  w.heading("Matériel loué");
  const material: [string, string][] = [["Type de matériel", type.name]];
  if (equipment) {
    material.push(["Appareil", equipment.label]);
    if (equipment.serialNumber) material.push(["Numéro de série", equipment.serialNumber]);
    if (equipment.condition) material.push(["État à la remise", equipment.condition]);
  } else if (rental.source === "SUPPLIER") {
    material.push(["Provenance", `${SOURCE_LABELS.SUPPLIER}${rental.supplier ? ` (${rental.supplier})` : ""}`]);
  } else {
    material.push(["Appareil", "À préciser lors de la remise"]);
  }
  w.rows(material);

  w.heading("Prescription médicale");
  w.rows([
    ["Prescripteur", rental.prescriber ?? "Non renseigné"],
    ["Ordonnance du", rental.prescriptionDate ? formatDay(rental.prescriptionDate) : "Non renseignée"],
    ["Durée prescrite", rental.prescriptionDurationDays ? `${rental.prescriptionDurationDays} jours` : "Non renseignée"],
    ["Valable jusqu'au", rental.prescriptionExpiresAt ? formatDay(rental.prescriptionExpiresAt) : "Non renseignée"],
  ]);

  w.heading("Durée de la location");
  w.rows([
    ["Début", rental.startDate ? formatDay(rental.startDate) : "À la remise du matériel"],
    ["Fin prévue", rental.plannedEndDate ? formatDay(rental.plannedEndDate) : "Selon la prescription"],
  ]);

  w.heading("Conditions financières");
  w.rows([
    [
      "Tarif",
      rental.priceCents != null
        ? `${formatEuros(rental.priceCents)} ${PRICE_SUFFIX[rental.billingPeriod]}`
        : `Selon le tarif en vigueur à l'officine, facturé ${PRICE_SUFFIX[rental.billingPeriod]}`,
    ],
    [
      "Caution",
      rental.depositCents != null
        ? `${formatEuros(rental.depositCents)} par empreinte bancaire (aucun prélèvement à la mise en place)`
        : "Sans caution",
    ],
  ]);

  // Conditions générales
  w.heading("Conditions générales de location");
  for (const block of parseTerms(pharmacy.contractTerms?.trim() || DEFAULT_CONTRACT_TERMS)) {
    if (block.kind === "heading") {
      w.space(5);
      w.text(block.text, { size: 9.5, bold: true });
    } else {
      w.text(block.text, { size: 9, lineHeight: 12.5 });
      w.space(3);
    }
  }

  // Signatures
  w.space(14);
  w.text(
    `Fait en deux exemplaires${pharmacy.city ? ` à ${pharmacy.city}` : ""}, le ${formatLongDay(today).toLowerCase()}.`,
  );
  w.space(10);
  w.signatures(
    ["Le loueur", pharmacy.name, "Signature et cachet"],
    ["Le locataire", patientName(patient), "Signature précédée de la mention « lu et approuvé »"],
  );

  w.finish(`Contrat ${rental.number} · ${pharmacy.name}`);
  return Buffer.from(await doc.save());
}
