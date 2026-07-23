-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN     "includeAuditLog" BOOLEAN NOT NULL DEFAULT false;

-- Backfill includeAuditLog from the effective team/organisation setting
UPDATE "DocumentMeta" AS dm
SET "includeAuditLog" = COALESCE(tgs."includeAuditLog", ogs."includeAuditLog")
FROM "Envelope" e
JOIN "Team" t ON t."id" = e."teamId"
JOIN "TeamGlobalSettings" tgs ON tgs."id" = t."teamGlobalSettingsId"
JOIN "Organisation" o ON o."id" = t."organisationId"
JOIN "OrganisationGlobalSettings" ogs ON ogs."id" = o."organisationGlobalSettingsId"
WHERE e."documentMetaId" = dm."id";
