-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "defaultRecipients" JSONB;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "defaultRecipients" JSONB;
