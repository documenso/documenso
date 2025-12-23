-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "delegateDocumentOwnership" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "delegateDocumentOwnership" BOOLEAN;
