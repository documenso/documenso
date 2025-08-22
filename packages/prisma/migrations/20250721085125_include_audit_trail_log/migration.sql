-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "includeAuditLog" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "includeAuditLog" BOOLEAN;
