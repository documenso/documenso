-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "useLegacyFieldInsertion" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "useLegacyFieldInsertion" BOOLEAN NOT NULL DEFAULT true;
