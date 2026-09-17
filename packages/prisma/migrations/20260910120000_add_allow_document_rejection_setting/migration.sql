-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN     "allowDocumentRejection" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "allowDocumentRejection" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "allowDocumentRejection" BOOLEAN;
