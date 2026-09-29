-- AlterTable: add with DEFAULT false so every existing row is backfilled to
-- disabled, then flip the column default to true so new rows are enabled.
ALTER TABLE "DocumentMeta" ADD COLUMN "qrSignatureEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DocumentMeta" ALTER COLUMN "qrSignatureEnabled" SET DEFAULT true;

ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN "qrSignatureEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrganisationGlobalSettings" ALTER COLUMN "qrSignatureEnabled" SET DEFAULT true;

-- Existing teams stay NULL (inherit from organisation).
ALTER TABLE "TeamGlobalSettings" ADD COLUMN "qrSignatureEnabled" BOOLEAN;
