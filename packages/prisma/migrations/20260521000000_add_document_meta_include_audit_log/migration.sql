-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN     "includeAuditLog" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing rows from the effective team/organisation setting. Before this
-- column existed the sealing flow read `includeAuditLog` from the team settings
-- (falling back to the organisation default), so documents created prior to this
-- migration must keep that resolved value to avoid silently dropping audit-log
-- embedding after deploy.
UPDATE "DocumentMeta" AS dm
SET "includeAuditLog" = COALESCE(tgs."includeAuditLog", ogs."includeAuditLog")
FROM "Envelope" e
JOIN "Team" t ON t."id" = e."teamId"
JOIN "TeamGlobalSettings" tgs ON tgs."id" = t."teamGlobalSettingsId"
JOIN "Organisation" o ON o."id" = t."organisationId"
JOIN "OrganisationGlobalSettings" ogs ON ogs."id" = o."organisationGlobalSettingsId"
WHERE e."documentMetaId" = dm."id";
