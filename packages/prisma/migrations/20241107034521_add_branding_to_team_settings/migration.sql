-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "brandingCompanyDetails" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "brandingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "brandingHidePoweredBy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "brandingLogo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "brandingUrl" TEXT NOT NULL DEFAULT '';
