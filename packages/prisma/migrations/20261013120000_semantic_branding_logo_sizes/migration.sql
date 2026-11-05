UPDATE "OrganisationGlobalSettings"
SET "brandingLogoSize" = CASE "brandingLogoSize"
  WHEN 'h-6' THEN 'SMALL'
  WHEN 'h-8' THEN 'MEDIUM'
  WHEN 'h-12' THEN 'LARGE'
  WHEN 'h-16' THEN 'EXTRA_LARGE'
END
WHERE "brandingLogoSize" IN ('h-6', 'h-8', 'h-12', 'h-16');

UPDATE "TeamGlobalSettings"
SET "brandingLogoSize" = CASE "brandingLogoSize"
  WHEN 'h-6' THEN 'SMALL'
  WHEN 'h-8' THEN 'MEDIUM'
  WHEN 'h-12' THEN 'LARGE'
  WHEN 'h-16' THEN 'EXTRA_LARGE'
END
WHERE "brandingLogoSize" IN ('h-6', 'h-8', 'h-12', 'h-16');

ALTER TABLE "OrganisationGlobalSettings" ALTER COLUMN "brandingLogoSize" SET DEFAULT 'SMALL';
