/*
  Warnings:

  - You are about to drop the `TemplateField` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TemplateRecipient` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[templateId,email]` on the table `Recipient` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Field" DROP CONSTRAINT "Field_recipientId_fkey";

-- DropForeignKey
ALTER TABLE "TemplateField" DROP CONSTRAINT "TemplateField_recipientId_fkey";

-- DropForeignKey
ALTER TABLE "TemplateField" DROP CONSTRAINT "TemplateField_templateId_fkey";

-- DropForeignKey
ALTER TABLE "TemplateRecipient" DROP CONSTRAINT "TemplateRecipient_templateId_fkey";

-- AlterTable
ALTER TABLE "Field" ADD COLUMN     "templateId" INTEGER,
ALTER COLUMN "documentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Recipient" ADD COLUMN     "templateId" INTEGER,
ALTER COLUMN "documentId" DROP NOT NULL,
ALTER COLUMN "readStatus" DROP NOT NULL,
ALTER COLUMN "signingStatus" DROP NOT NULL,
ALTER COLUMN "sendStatus" DROP NOT NULL;

-- DropTable
DROP TABLE "TemplateField";

-- DropTable
DROP TABLE "TemplateRecipient";

-- CreateIndex
CREATE INDEX "Field_templateId_idx" ON "Field"("templateId");

-- CreateIndex
CREATE INDEX "Recipient_templateId_idx" ON "Recipient"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipient_templateId_email_key" ON "Recipient"("templateId", "email");

-- AddForeignKey
ALTER TABLE "Recipient" ADD CONSTRAINT "Recipient_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Field" ADD CONSTRAINT "Field_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Field" ADD CONSTRAINT "Field_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
