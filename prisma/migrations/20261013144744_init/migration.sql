-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('WEEKLY', 'MONTHLY', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'RENTED', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "Ownership" AS ENUM ('PHARMACY', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('DRAFT', 'ORDERED', 'ACTIVE', 'TO_CLOSE', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Pharmacy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rentalCounter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Pharmacy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "pharmacyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentType" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'WEEKLY',
    "defaultDurationDays" INTEGER,
    "depositCents" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EquipmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "serialNumber" TEXT,
    "ownership" "Ownership" NOT NULL DEFAULT 'PHARMACY',
    "supplier" TEXT,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "birthDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rental" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "RentalStatus" NOT NULL DEFAULT 'DRAFT',
    "patientId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "prescriber" TEXT,
    "prescriptionDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "returnDate" TIMESTAMP(3),
    "supplier" TEXT,
    "deliveryNoteNumber" TEXT,
    "billingPeriod" "BillingPeriod" NOT NULL,
    "billedUntil" TIMESTAMP(3),
    "depositCents" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalEvent" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "userId" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentType_pharmacyId_name_key" ON "EquipmentType"("pharmacyId", "name");

-- CreateIndex
CREATE INDEX "Equipment_pharmacyId_status_idx" ON "Equipment"("pharmacyId", "status");

-- CreateIndex
CREATE INDEX "Patient_pharmacyId_lastName_idx" ON "Patient"("pharmacyId", "lastName");

-- CreateIndex
CREATE INDEX "Rental_pharmacyId_status_idx" ON "Rental"("pharmacyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Rental_pharmacyId_number_key" ON "Rental"("pharmacyId", "number");

-- CreateIndex
CREATE INDEX "RentalEvent_rentalId_idx" ON "RentalEvent"("rentalId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentType" ADD CONSTRAINT "EquipmentType_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "EquipmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "EquipmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalEvent" ADD CONSTRAINT "RentalEvent_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalEvent" ADD CONSTRAINT "RentalEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
