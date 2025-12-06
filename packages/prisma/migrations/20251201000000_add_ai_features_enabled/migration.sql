-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN "aiFeaturesEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN "aiFeaturesEnabled" BOOLEAN;

