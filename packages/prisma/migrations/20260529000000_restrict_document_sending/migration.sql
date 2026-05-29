-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "restrictDocumentSending" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "restrictDocumentSending" BOOLEAN;
