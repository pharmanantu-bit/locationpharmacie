"use server";

import type { BillingPeriod, Prisma, RentalStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { addDays, formatDay, parseDay, parseEuros, todayUTC } from "@/lib/dates";
import { db } from "@/lib/db";
import { billedUntilAfter, nextBillingDate, rentalNumber } from "@/lib/rentals";

export type RentalFormState = { error?: string } | undefined;

const BILLING_PERIODS: BillingPeriod[] = ["WEEKLY", "MONTHLY", "ONE_OFF"];

function text(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
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

export async function createRental(_prev: RentalFormState, formData: FormData): Promise<RentalFormState> {
  const user = await requireUser();

  const typeId = text(formData, "typeId");
  const type = typeId
    ? await db.equipmentType.findFirst({ where: { id: typeId, pharmacyId: user.pharmacyId } })
    : null;
  if (!type) return { error: "Choisissez le type de matériel." };

  const initialStatus = text(formData, "initialStatus") as RentalStatus | null;
  if (!initialStatus || !["DRAFT", "ORDERED", "ACTIVE"].includes(initialStatus)) {
    return { error: "Statut initial invalide." };
  }

  const startDate = parseDay(formData.get("startDate"));
  const plannedEndDate = parseDay(formData.get("plannedEndDate"));
  if (initialStatus === "ACTIVE" && !startDate) {
    return { error: "Indiquez la date de début pour remettre le matériel au patient." };
  }
  if (startDate && plannedEndDate && plannedEndDate < startDate) {
    return { error: "La fin prévue est antérieure au début." };
  }

  const billingPeriod = (text(formData, "billingPeriod") ?? type.billingPeriod) as BillingPeriod;
  if (!BILLING_PERIODS.includes(billingPeriod)) return { error: "Périodicité invalide." };

  const equipmentId = text(formData, "equipmentId");

  // Patient existant ou nouveau
  let patientId = text(formData, "patientId");
  const newPatient = {
    lastName: text(formData, "patientLastName"),
    firstName: text(formData, "patientFirstName"),
    phone: text(formData, "patientPhone"),
    email: text(formData, "patientEmail"),
    address: text(formData, "patientAddress"),
  };
  if (patientId) {
    const exists = await db.patient.findFirst({ where: { id: patientId, pharmacyId: user.pharmacyId } });
    if (!exists) return { error: "Patient introuvable." };
  } else if (!newPatient.lastName || !newPatient.firstName) {
    return { error: "Choisissez un patient ou renseignez le nom et le prénom du nouveau patient." };
  }

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
          },
        });
        patientId = p.id;
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
          prescriber: text(formData, "prescriber"),
          prescriptionDate: parseDay(formData.get("prescriptionDate")),
          startDate,
          plannedEndDate,
          supplier: text(formData, "supplier"),
          deliveryNoteNumber: text(formData, "deliveryNoteNumber"),
          billingPeriod,
          depositCents: parseEuros(formData.get("deposit")),
          notes: text(formData, "notes"),
        },
      });

      if (equipmentId && initialStatus === "ACTIVE") {
        await tx.equipment.update({ where: { id: equipmentId }, data: { status: "RENTED" } });
      }
      await logEvent(tx, rental.id, user, "Dossier créé");
      if (initialStatus === "ACTIVE") await logEvent(tx, rental.id, user, "Matériel remis au patient");
      return rental.id;
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur à l'enregistrement." };
  }

  revalidatePath("/app", "layout");
  redirect(`/app/dossiers/${rentalId}`);
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

  await db.$transaction(async (tx) => {
    await tx.rental.update({
      where: { id: rental.id },
      data: {
        prescriber: text(formData, "prescriber"),
        prescriptionDate: parseDay(formData.get("prescriptionDate")),
        startDate,
        plannedEndDate,
        supplier: text(formData, "supplier"),
        deliveryNoteNumber: text(formData, "deliveryNoteNumber"),
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
  return {};
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
    await tx.rental.update({ where: { id: rental.id }, data: { status: "ORDERED" } });
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

  await db.$transaction(async (tx) => {
    await tx.rental.update({ where: { id: rental.id }, data: { status: "TO_CLOSE", returnDate } });
    if (rental.equipmentId) {
      await tx.equipment.update({
        where: { id: rental.equipmentId },
        data: { status: needsService ? "MAINTENANCE" : "AVAILABLE" },
      });
    }
    await logEvent(tx, rental.id, user, `Matériel rendu le ${formatDay(returnDate)}`);
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
