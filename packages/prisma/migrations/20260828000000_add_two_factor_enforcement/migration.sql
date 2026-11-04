-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "twoFactorEnforcedFrom" TIMESTAMP(3),
ADD COLUMN     "twoFactorGracePeriodDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "twoFactorRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "authMethod" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN     "twoFactorVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twoFactorGraceStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: existing users' grace windows anchor at account creation, not at
-- migration time.
UPDATE "User" SET "twoFactorGraceStartedAt" = "createdAt";
