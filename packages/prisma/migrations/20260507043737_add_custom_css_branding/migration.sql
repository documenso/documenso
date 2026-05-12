-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "brandingColors" JSONB,
ADD COLUMN     "brandingCss" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "brandingColors" JSONB,
ADD COLUMN     "brandingCss" TEXT;
