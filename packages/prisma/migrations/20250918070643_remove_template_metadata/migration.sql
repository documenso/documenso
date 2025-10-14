-- DropForeignKey
ALTER TABLE "TemplateMeta" DROP CONSTRAINT "TemplateMeta_templateId_fkey";

-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN     "templateId" INTEGER,
ALTER COLUMN "documentId" DROP NOT NULL;

-- [CUSTOM_CHANGE] Migrate existing TemplateMeta to DocumentMeta
INSERT INTO "DocumentMeta" (
  "id",
  "subject",
  "message",
  "timezone",
  "password",
  "dateFormat",
  "redirectUrl",
  "signingOrder",
  "allowDictateNextSigner",
  "typedSignatureEnabled",
  "uploadSignatureEnabled",
  "drawSignatureEnabled",
  "language",
  "distributionMethod",
  "emailSettings",
  "emailReplyTo",
  "emailId",
  "templateId"
)
SELECT
  gen_random_uuid()::text, -- Generate new CUID-like IDs to avoid collisions
  "subject",
  "message",
  "timezone",
  "password",
  "dateFormat",
  "redirectUrl",
  "signingOrder",
  "allowDictateNextSigner",
  "typedSignatureEnabled",
  "uploadSignatureEnabled",
  "drawSignatureEnabled",
  "language",
  "distributionMethod",
  "emailSettings",
  "emailReplyTo",
  "emailId",
  "templateId"
FROM "TemplateMeta";

-- DropTable
DROP TABLE "TemplateMeta";

-- CreateIndex
CREATE UNIQUE INDEX "DocumentMeta_templateId_key" ON "DocumentMeta"("templateId");

-- AddForeignKey
ALTER TABLE "DocumentMeta" ADD CONSTRAINT "DocumentMeta_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
