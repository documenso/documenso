-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN     "drawSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "uploadSignatureEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "drawSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "uploadSignatureEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "TemplateMeta" ADD COLUMN     "drawSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "uploadSignatureEnabled" BOOLEAN NOT NULL DEFAULT true;
