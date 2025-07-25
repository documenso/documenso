-- [CUSTOM_MIGRATION] Required to fill in missing rows for `emailDocumentSettings` column.
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "emailDocumentSettings" JSONB;

-- [CUSTOM_CHANGE] Insert default values for `emailDocumentSettings` column.
UPDATE "OrganisationGlobalSettings"
SET "emailDocumentSettings" = '{
  "recipientSigningRequest": true,
  "recipientRemoved": true,
  "recipientSigned": true,
  "documentPending": true,
  "documentCompleted": true,
  "documentDeleted": true,
  "ownerDocumentCompleted": true
}'::jsonb
WHERE "emailDocumentSettings" IS NULL;

-- CreateEnum
CREATE TYPE "EmailDomainStatus" AS ENUM ('PENDING', 'ACTIVE');

-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN     "emailId" TEXT,
ADD COLUMN     "emailReplyTo" TEXT;

-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "documentDateFormat" TEXT NOT NULL DEFAULT 'yyyy-MM-dd hh:mm a',
ADD COLUMN     "documentTimezone" TEXT,
ADD COLUMN     "emailId" TEXT,
ADD COLUMN     "emailReplyTo" TEXT;

-- [CUSTOM_MIGRATION] Set the `emailDocumentSettings` column back to not null.
ALTER TABLE "OrganisationGlobalSettings" ALTER COLUMN "emailDocumentSettings" SET NOT NULL;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "documentDateFormat" TEXT,
ADD COLUMN     "documentTimezone" TEXT,
ADD COLUMN     "emailDocumentSettings" JSONB,
ADD COLUMN     "emailId" TEXT,
ADD COLUMN     "emailReplyTo" TEXT;

-- AlterTable
ALTER TABLE "TemplateMeta" ADD COLUMN     "emailId" TEXT,
ADD COLUMN     "emailReplyTo" TEXT;

-- CreateTable
CREATE TABLE "EmailDomain" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "EmailDomainStatus" NOT NULL DEFAULT 'PENDING',
    "selector" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,

    CONSTRAINT "EmailDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationEmail" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "emailName" TEXT NOT NULL,
    "emailDomainId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,

    CONSTRAINT "OrganisationEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailDomain_selector_key" ON "EmailDomain"("selector");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDomain_domain_key" ON "EmailDomain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationEmail_email_key" ON "OrganisationEmail"("email");

-- AddForeignKey
ALTER TABLE "OrganisationGlobalSettings" ADD CONSTRAINT "OrganisationGlobalSettings_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OrganisationEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamGlobalSettings" ADD CONSTRAINT "TeamGlobalSettings_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OrganisationEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDomain" ADD CONSTRAINT "EmailDomain_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationEmail" ADD CONSTRAINT "OrganisationEmail_emailDomainId_fkey" FOREIGN KEY ("emailDomainId") REFERENCES "EmailDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationEmail" ADD CONSTRAINT "OrganisationEmail_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
