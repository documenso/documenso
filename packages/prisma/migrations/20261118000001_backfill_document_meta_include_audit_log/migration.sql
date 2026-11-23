-- Sealing used the team setting until now, so existing envelopes take that value.
-- The column defaults to false, so only the rows that resolve to true are written.
UPDATE "DocumentMeta" AS dm
SET "includeAuditLog" = true
FROM "Envelope" e
JOIN "Team" t ON t."id" = e."teamId"
JOIN "TeamGlobalSettings" tgs ON tgs."id" = t."teamGlobalSettingsId"
JOIN "Organisation" o ON o."id" = t."organisationId"
JOIN "OrganisationGlobalSettings" ogs ON ogs."id" = o."organisationGlobalSettingsId"
WHERE e."documentMetaId" = dm."id"
  AND COALESCE(tgs."includeAuditLog", ogs."includeAuditLog");
