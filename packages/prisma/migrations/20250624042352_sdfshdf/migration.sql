/*
  Warnings:

  - Added the required column `emailDocumentSettings` to the `OrganisationGlobalSettings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "emailDocumentSettings" JSONB,
ADD COLUMN     "emailId" TEXT,
ADD COLUMN     "emailReplyTo" TEXT,
ADD COLUMN     "emailReplyToName" TEXT;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "emailDocumentSettings" JSONB,
ADD COLUMN     "emailId" TEXT,
ADD COLUMN     "emailReplyTo" TEXT,
ADD COLUMN     "emailReplyToName" TEXT;

-- Update existing records with default email document settings
UPDATE "OrganisationGlobalSettings"
SET "emailDocumentSettings" = '{"recipientSigningRequest": true, "recipientRemoved": true, "recipientSigned": true, "documentPending": true, "documentCompleted": true, "documentDeleted": true, "ownerDocumentCompleted": true}'::jsonb
WHERE "emailDocumentSettings" IS NULL;

-- Make emailDocumentSettings NOT NULL after filling with default values
ALTER TABLE "OrganisationGlobalSettings" ALTER COLUMN "emailDocumentSettings" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "OrganisationGlobalSettings" ADD CONSTRAINT "OrganisationGlobalSettings_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OrganisationEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamGlobalSettings" ADD CONSTRAINT "TeamGlobalSettings_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OrganisationEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;
