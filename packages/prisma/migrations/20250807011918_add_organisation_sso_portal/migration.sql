/*
  Warnings:

  - A unique constraint covering the columns `[organisationAuthenticationPortalId]` on the table `Organisation` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organisationAuthenticationPortalId` to the `Organisation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserSecurityAuditLogType" ADD VALUE 'ACCOUNT_SSO_UNLINK';
ALTER TYPE "UserSecurityAuditLogType" ADD VALUE 'ORGANISATION_SSO_LINK';
ALTER TYPE "UserSecurityAuditLogType" ADD VALUE 'ORGANISATION_SSO_UNLINK';

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- [CUSTOM_CHANGE] This is supposed to be NOT NULL but we reapply it at the end.
ALTER TABLE "Organisation" ADD COLUMN     "organisationAuthenticationPortalId" TEXT;

-- AlterTable
ALTER TABLE "VerificationToken" ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "OrganisationAuthenticationPortal" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT NOT NULL DEFAULT '',
    "clientSecret" TEXT NOT NULL DEFAULT '',
    "wellKnownUrl" TEXT NOT NULL DEFAULT '',
    "defaultOrganisationRole" "OrganisationMemberRole" NOT NULL DEFAULT 'MEMBER',
    "autoProvisionUsers" BOOLEAN NOT NULL DEFAULT true,
    "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "organisationId" TEXT, -- [CUSTOM_CHANGE] This is a temporary column for migration purposes.

    CONSTRAINT "OrganisationAuthenticationPortal_pkey" PRIMARY KEY ("id")
);

-- [CUSTOM_CHANGE] Create default OrganisationAuthenticationPortal for all organisations
INSERT INTO "OrganisationAuthenticationPortal" ("id", "enabled", "clientId", "clientSecret", "wellKnownUrl", "defaultOrganisationRole", "autoProvisionUsers", "allowedDomains", "organisationId")
SELECT
  generate_prefix_id('org_sso'),
  false,
  '',
  '',
  '',
  'MEMBER',
  true,
  ARRAY[]::TEXT[],
  o."id"
FROM "Organisation" o
WHERE o."organisationAuthenticationPortalId" IS NULL;

-- [CUSTOM_CHANGE] Update organisations with their corresponding organisationAuthenticationPortalId
UPDATE "Organisation" o
SET "organisationAuthenticationPortalId" = oap."id"
FROM "OrganisationAuthenticationPortal" oap
WHERE oap."organisationId" = o."id" AND o."organisationAuthenticationPortalId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_organisationAuthenticationPortalId_key" ON "Organisation"("organisationAuthenticationPortalId");

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_organisationAuthenticationPortalId_fkey" FOREIGN KEY ("organisationAuthenticationPortalId") REFERENCES "OrganisationAuthenticationPortal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- [CUSTOM_CHANGE] Reapply NOT NULL constraint.
ALTER TABLE "Organisation" ALTER COLUMN "organisationAuthenticationPortalId" SET NOT NULL;

-- [CUSTOM_CHANGE] Drop temporary column.
ALTER TABLE "OrganisationAuthenticationPortal" DROP COLUMN "organisationId";