"use server";

import type { BillingPeriod, Prisma, RentalSource, RentalStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { addDays, formatDay, parseDay, parseEuros, todayUTC } from "@/lib/dates";
import { db } from "@/lib/db";
import { readUpload, storeDocument, UPLOAD_ERRORS } from "@/lib/documents";
import { logEquipmentEvent } from "@/lib/equipment";
import { billedUntilAfter, nextBillingDate, rentalNumber } from "@/lib/rentals";

export type RentalFormState = { error?: string; ok?: boolean } | undefined;

const BILLING_PERIODS: BillingPeriod[] = ["WEEKLY", "MONTHLY", "ONE_OFF"];
const SOURCES: RentalSource[] = ["PHARMACY_STOCK", "SUPPLIER"];

function text(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function positiveInt(formData: FormData, key: string): number | null {
  const n = Number(text(formData, key));
  return Number.isInteger(n) && n > 0 ? n : null;
}

type Tx = Prisma.TransactionClient;

async function logEvent(tx: Tx, rentalId: string, user: CurrentUser, message: string) {
  await tx.rentalEvent.create({ data: { rentalId, userId: user.id, message } });
}

// Vérifie que le matériel appartient à la pharmacie, est du bon type et est libre
async function checkEquipment(tx: Tx, user: CurrentUser, equipmentId: string, typeId: string) {
  const equipment = await tx.equipment.findFirst({
    where: { id: equipmentId, pharmacyId: user.pharmacyId },
  });
  if (!equipment) throw new Error("Matériel introuvable.");
  if (equipment.typeId !== typeId) throw new Error("Ce matériel ne correspond pas au type du dossier.");
  if (equipment.status !== "AVAILABLE") throw new Error(`« ${equipment.label} » n'est pas disponible.`);
  return equipment;
}

// Champs de l'ordonnance (étape 3), communs à la création et à la modification
function readPrescription(formData: FormData) {
  const prescriptionDate = parseDay(formData.get("prescriptionDate"));
  const prescriptionDurationDays = positiveInt(formData, "prescriptionDurationDays");
  let prescriptionExpiresAt = parseDay(formData.get("prescriptionExpiresAt"));
  if (!prescriptionExpiresAt && prescriptionDate && prescriptionDurationDays) {
    prescriptionExpiresAt = addDays(prescriptionDate, prescriptionDurationDays);
  }
  return {
    prescriber: text(formData, "prescriber"),
    prescriptionDate,
    prescriptionDurationDays,
    prescriptionExpiresAt,
  };
}

export async function createRental(_prev: RentalFormState, formData: FormData): Promise<RentalFormState> {
  const user = await requireUser();

  // Étape 1 : patient et matériel
  const typeId = text(formData, "typeId");
  const type = typeId
    ? await db.equipmentType.findFirst({ where: { id: typeId, pharmacyId: user.pharmacyId } })
    : null;
  if (!type) return { error: "Choisissez le type de matériel." };

  let patientId = text(formData, "patientId");
  const newPatient = {
    lastName: text(formData, "patientLastName"),
    firstName: text(formData, "patientFirstName"),
    phone: text(formData, "patientPhone"),
    email: text(formData, "patientEmail"),
    address: text(formData, "patientAddress"),
  };
  const smsConsent = formData.get("smsConsent") === "on";
  if (patientId) {
    const exists = await db.patient.findFirst({ where: { id: patientId, pharmacyId: user.pharmacyId } });
    if (!exists) return { error: "Patient introuvable." };
  } else if (!newPatient.lastName || !newPatient.firstName) {
    return { error: "Choisissez un patient ou renseignez le nom et le prénom du nouveau patient." };
  }

  // Étape 2 : source du matériel
  const source = text(formData, "source") as RentalSource | null;
  if (!source || !SOURCES.includes(source)) return { error: "Indiquez d'où vient le matériel." };
  const initialStatus = text(formData, "initialStatus") as RentalStatus | null;
  if (!initialStatus || !["DRAFT", "ORDERED", "ACTIVE"].includes(initialStatus)) {
    return { error: "Statut initial invalide." };
  }
  if (initialStatus === "ORDERED" && source !== "SUPPLIER") {
    return { error: "Seul un matériel commandé à un fournisseur peut être « commandé »." };
  }
  const equipmentId = source === "PHARMACY_STOCK" ? text(formData, "equipmentId") : null;
  const supplier = source === "SUPPLIER" ? text(formData, "supplier") : null;

  // Étape 3 : ordonnance et durée
  const prescription = readPrescription(formData);
  const startDate = parseDay(formData.get("startDate"));
  let plannedEndDate = parseDay(formData.get("plannedEndDate"));
  if (!plannedEndDate && startDate && prescription.prescriptionDurationDays) {
    plannedEndDate = addDays(startDate, prescription.prescriptionDurationDays);
  }
  if (initialStatus === "ACTIVE" && !startDate) {
    return { error: "Indiquez la date de début pour remettre le matériel au patient." };
  }
  if (startDate && plannedEndDate && plannedEndDate < startDate) {
    return { error: "La fin prévue est antérieure au début." };
  }
  const upload = await readUpload(formData.get("prescriptionFile"));
  if (upload && "error" in upload) return { error: UPLOAD_ERRORS[upload.error] };

  const billingPeriod = (text(formData, "billingPeriod") ?? type.billingPeriod) as BillingPeriod;
  if (!BILLING_PERIODS.includes(billingPeriod)) return { error: "Périodicité invalide." };

  let rentalId: string;
  try {
    rentalId = await db.$transaction(async (tx) => {
      if (!patientId) {
        const p = await tx.patient.create({
          data: {
            pharmacyId: user.pharmacyId,
            lastName: newPatient.lastName!,
            firstName: newPatient.firstName!,
            phone: newPatient.phone,
            email: newPatient.email,
            address: newPatient.address,
            smsConsent,
            smsConsentAt: smsConsent ? new Date() : null,
          },
        });
        patientId = p.id;
      } else if (smsConsent) {
        await tx.patient.updateMany({
          where: { id: patientId, smsConsent: false },
          data: { smsConsent: true, smsConsentAt: new Date() },
        });
      }

      if (equipmentId) await checkEquipment(tx, user, equipmentId, type.id);

      const pharmacy = await tx.pharmacy.update({
        where: { id: user.pharmacyId },
        data: { rentalCounter: { increment: 1 } },
      });

      const rental = await tx.rental.create({
        data: {
          pharmacyId: user.pharmacyId,
          number: rentalNumber(todayUTC().getUTCFullYear(), pharmacy.rentalCounter),
          status: initialStatus,
          patientId: patientId!,
          typeId: type.id,
          equipmentId,
          source,
          supplier,
          deliveryNoteNumber: source === "SUPPLIER" ? text(formData, "deliveryNoteNumber") : null,
          ...prescription,
          startDate,
          plannedEndDate,
          billingPeriod,
          depositCents: parseEuros(formData.get("deposit")) ?? type.depositCents,
          notes: text(formData, "notes"),
        },
      });

      if (equipmentId && initialStatus === "ACTIVE") {
        await tx.equipment.update({ where: { id: equipmentId }, data: { status: "RENTED" } });
        await logEquipmentEvent(tx, user, equipmentId, "RENTED", `Remis au patient (dossier ${rental.number})`, rental.id);
      }
      await logEvent(tx, rental.id, user, "Dossier créé");
      if (upload) {
        const doc = await storeDocument(tx, user, rental.id, "PRESCRIPTION", upload);
        await audit(tx, user, "document.upload", "Document", doc.id);
        await logEvent(tx, rental.id, user, `Ordonnance jointe (${upload.fileName})`);
      }
      if (initialStatus === "ORDERED") await logEvent(tx, rental.id, user, `Matériel commandé${supplier ? ` chez ${supplier}` : ""}`);
      if (initialStatus === "ACTIVE") await logEvent(tx, rental.id, user, "Matériel remis au patient");
      return rental.id;
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur à l'enregistrement." };
  }

  revalidatePath("/app", "layout");
  redirect(`/app/dossiers/${rentalId}`);
}

// Ajout (ou remplacement) de l'ordonnance sur un dossier existant
export async function uploadPrescription(_prev: RentalFormState, formData: FormData): Promise<RentalFormState> {
  const user = await requireUser();
  const rental = await getRental(user, String(formData.get("rentalId")));
  if (rental.status === "CLOSED" || rental.status === "CANCELLED") {
    return { error: "Un dossier clôturé ou annulé ne peut plus être modifié." };
  }
  const upload = await readUpload(formData.get("prescriptionFile"));
  if (!upload) return { error: "Choisissez un fichier (PDF ou photo de l'ordonnance)." };
  if ("error" in upload) return { error: UPLOAD_ERRORS[upload.error] };

  await db.$transaction(async (tx) => {
    const doc = await storeDocument(tx, user, rental.id, "PRESCRIPTION", upload);
    await audit(tx, user, "document.upload", "Document", doc.id);
    await logEvent(tx, rental.id, user, `Ordonnance jointe (${upload.fileName})`);
  });
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function updateRental(_prev: RentalFormState, formData: FormData): Promise<RentalFormState> {
  const user = await requireUser();
  const rental = await getRental(user, String(formData.get("rentalId")));
  if (rental.status === "CLOSED" || rental.status === "CANCELLED") {
    return { error: "Un dossier clôturé ou annulé ne peut plus être modifié." };
  }

  const startDate = parseDay(formData.get("startDate"));
  const plannedEndDate = parseDay(formData.get("plannedEndDate"));
  if (startDate && plannedEndDate && plannedEndDate < startDate) {
    return { error: "La fin prévue est antérieure au début." };
  }
  const billingPeriod = text(formData, "billingPeriod") as BillingPeriod;
  if (!BILLING_PERIODS.includes(billingPeriod)) return { error: "Périodicité invalide." };
  const source = text(formData, "source") as RentalSource | null;
  if (!source || !SOURCES.includes(source)) return { error: "Source du matériel invalide." };

  await db.$transaction(async (tx) => {
    await tx.rental.update({
      where: { id: rental.id },
      data: {
        source,
        supplier: text(formData, "supplier"),
        deliveryNoteNumber: text(formData, "deliveryNoteNumber"),
        ...readPrescription(formData),
        startDate,
        plannedEndDate,
        billingPeriod,
        depositCents: parseEuros(formData.get("deposit")),
        notes: text(formData, "notes"),
      },
    });
    const changes: string[] = [];
    if (plannedEndDate?.getTime() !== rental.plannedEndDate?.getTime()) {
      changes.push(`fin prévue → ${formatDay(plannedEndDate)}`);
    }
    if (startDate?.getTime() !== rental.startDate?.getTime()) {
      changes.push(`début → ${formatDay(startDate)}`);
    }
    await logEvent(tx, rental.id, user, changes.length ? `Dossier modifié (${changes.join(", ")})` : "Dossier modifié");
  });

  revalidatePath("/app", "layout");
  return { ok: true };
}

async function getRental(user: CurrentUser, id: string) {
  const rental = await db.rental.findFirst({ where: { id, pharmacyId: user.pharmacyId } });
  if (!rental) throw new Error("Dossier introuvable.");
  return rental;
}

function done(id: string) {
  revalidatePath("/app", "layout");
  redirect(`/app/dossiers/${id}`);
}

export async function markOrdered(formData: FormData) {
  const user = await requireUser();
  const rental = await getRental(user, String(formData.get("rentalId")));
  if (rental.status !== "DRAFT") throw new Error("Transition impossible.");
  await db.$transaction(async (tx) => {
    await tx.rental.update({ where: { id: rental.id }, data: { status: "ORDERED", source: "SUPPLIER" } });
    await logEvent(tx, rental.id, user, "Matériel commandé");
  });
  done(rental.id);
}

export async function startRental(_prev: RentalFormState, formData: FormData): Promise<RentalFormState> {
  const user = await requireUser();
  const rental = await getRental(user, String(formData.get("rentalId")));
  if (rental.status !== "DRAFT" && rental.status !== "ORDERED") return { error: "Transition impossible." };

  const startDate = parseDay(formData.get("startDate"));
  const plannedEndDate = parseDay(formData.get("plannedEndDate"));
  if (!startDate) return { error: "Indiquez la date de remise." };
  if (plannedEndDate && plannedEndDate < startDate) return { error: "La fin prévue est antérieure au début." };
  const equipmentId = text(formData, "equipmentId");

  try {
    await db.$transaction(async (tx) => {
      if (equipmentId) {
        await checkEquipment(tx, user, equipmentId, rental.typeId);
        await tx.equipment.update({ where: { id: equipmentId }, data: { status: "RENTED" } });
        await logEquipmentEvent(tx, user, equipmentId, "RENTED", `Remis au patient (dossier ${rental.number})`, rental.id);
      }
      await tx.rental.update({
        where: { id: rental.id },
        data: { status: "ACTIVE", startDate, plannedEndDate, equipmentId },
      });
      await logEvent(tx, rental.id, user, "Matériel remis au patient");
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur à l'enregistrement." };
  }
  done(rental.id);
}

export async function markReturned(_prev: RentalFormState, formData: FormData): Promise<RentalFormState> {
  const user = await requireUser();
  const rental = await getRental(user, String(formData.get("rentalId")));
  if (rental.status !== "ACTIVE") return { error: "Transition impossible." };
  const returnDate = parseDay(formData.get("returnDate"));
  if (!returnDate) return { error: "Indiquez la date de retour." };
  if (rental.startDate && returnDate < rental.startDate) return { error: "Le retour est antérieur au début." };
  const needsService = formData.get("needsService") === "on";
  const condition = text(formData, "condition");

  await db.$transaction(async (tx) => {
    await tx.rental.update({ where: { id: rental.id }, data: { status: "TO_CLOSE", returnDate } });
    if (rental.equipmentId) {
      await tx.equipment.update({
        where: { id: rental.equipmentId },
        data: { status: needsService ? "CLEANING" : "AVAILABLE", condition: condition ?? undefined },
      });
      await logEquipmentEvent(
        tx,
        user,
        rental.equipmentId,
        "RETURNED",
        `Retour du patient (dossier ${rental.number})${condition ? ` — état : ${condition}` : ""}${
          needsService ? " — à nettoyer" : ""
        }`,
        rental.id,
      );
    }
    await logEvent(tx, rental.id, user, `Matériel rendu le ${formatDay(returnDate)}${condition ? ` (état : ${condition})` : ""}`);
  });
  done(rental.id);
}

export async function closeRental(formData: FormData) {
  const user = await requireUser();
  const rental = await getRental(user, String(formData.get("rentalId")));
  if (rental.status !== "TO_CLOSE") throw new Error("Transition impossible.");
  await db.$transaction(async (tx) => {
    await tx.rental.update({ where: { id: rental.id }, data: { status: "CLOSED" } });
    await logEvent(tx, rental.id, user, "Dossier clôturé");
  });
  done(rental.id);
}

export async function cancelRental(formData: FormData) {
  const user = await requireUser();
  const rental = await getRental(user, String(formData.get("rentalId")));
  if (rental.status !== "DRAFT" && rental.status !== "ORDERED") throw new Error("Transition impossible.");
  await db.$transaction(async (tx) => {
    await tx.rental.update({ where: { id: rental.id }, data: { status: "CANCELLED" } });
    await logEvent(tx, rental.id, user, "Dossier annulé");
  });
  done(rental.id);
}

export async function markBilled(formData: FormData) {
  const user = await requireUser();
  const rental = await getRental(user, String(formData.get("rentalId")));
  const from = nextBillingDate(rental);
  const until = billedUntilAfter(rental);
  if (!from || !until) throw new Error("Rien à facturer.");
  await db.$transaction(async (tx) => {
    await tx.rental.update({ where: { id: rental.id }, data: { billedUntil: until } });
    await logEvent(
      tx,
      rental.id,
      user,
      rental.billingPeriod === "ONE_OFF"
        ? "Forfait facturé dans le LGO"
        : `Période facturée dans le LGO : du ${formatDay(from)} au ${formatDay(addDays(until, -1))}`,
    );
  });
  done(rental.id);
}

export async function addNote(formData: FormData) {
  const user = await requireUser();
  const rental = await getRental(user, String(formData.get("rentalId")));
  const note = text(formData, "note");
  if (note) {
    await db.rentalEvent.create({ data: { rentalId: rental.id, userId: user.id, message: note } });
  }
  done(rental.id);
}
