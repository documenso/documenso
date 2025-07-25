-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "includeAuditLog" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "includeAuditLog" BOOLEAN;
