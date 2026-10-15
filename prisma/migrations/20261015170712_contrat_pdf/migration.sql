-- AlterTable
ALTER TABLE "EquipmentType" ADD COLUMN     "priceCents" INTEGER;

-- AlterTable
ALTER TABLE "Pharmacy" ADD COLUMN     "contractTerms" TEXT,
ADD COLUMN     "siret" TEXT;

-- AlterTable
ALTER TABLE "Rental" ADD COLUMN     "priceCents" INTEGER;
