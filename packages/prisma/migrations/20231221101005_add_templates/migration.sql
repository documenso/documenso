/*
  Warnings:

  - A unique constraint covering the columns `[templateId,email]` on the table `Recipient` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('PUBLIC', 'PRIVATE');

-- DropForeignKey
ALTER TABLE "Field" DROP CONSTRAINT "Field_recipientId_fkey";

-- AlterTable
ALTER TABLE "Field" ADD COLUMN     "templateId" INTEGER,
ALTER COLUMN "documentId" DROP NOT NULL;

-- AlterTable
-- Add CHECK constraint to ensure that only one of the two columns is set
ALTER TABLE "Field" ADD CONSTRAINT "Field_templateId_documentId_check" CHECK (
    ("templateId" IS NULL AND "documentId" IS NOT NULL) OR
    ("templateId" IS NOT NULL AND "documentId" IS NULL)
);

-- AlterTable
ALTER TABLE "Recipient" ADD COLUMN     "templateId" INTEGER,
ALTER COLUMN "documentId" DROP NOT NULL;

-- AlterTable
-- Add CHECK constraint to ensure that only one of the two columns is set
ALTER TABLE "Recipient" ADD CONSTRAINT "Recipient_templateId_documentId_check" CHECK (
    ("templateId" IS NULL AND "documentId" IS NOT NULL) OR
    ("templateId" IS NOT NULL AND "documentId" IS NULL)
);

-- CreateTable
CREATE TABLE "Template" (
    "id" SERIAL NOT NULL,
    "type" "TemplateType" NOT NULL DEFAULT 'PRIVATE',
    "title" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "templateDocumentDataId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Template_templateDocumentDataId_key" ON "Template"("templateDocumentDataId");

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

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_templateDocumentDataId_fkey" FOREIGN KEY ("templateDocumentDataId") REFERENCES "DocumentData"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
