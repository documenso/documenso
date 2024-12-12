-- Existing templates should not have this enabled by default.
-- AlterTable
ALTER TABLE "TemplateMeta" ADD COLUMN     "typedSignatureEnabled" BOOLEAN NOT NULL DEFAULT false;

-- New templates should have this enabled by default.
-- AlterTable
ALTER TABLE "TemplateMeta" ALTER COLUMN "typedSignatureEnabled" SET DEFAULT true;
