-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "brandingLogoSize" TEXT NOT NULL DEFAULT 'h-6';

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "brandingLogoSize" TEXT;
