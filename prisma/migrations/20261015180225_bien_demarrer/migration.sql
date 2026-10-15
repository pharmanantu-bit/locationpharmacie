-- AlterTable
ALTER TABLE "Pharmacy" ADD COLUMN     "onboardingDone" TEXT[] DEFAULT ARRAY[]::TEXT[];
