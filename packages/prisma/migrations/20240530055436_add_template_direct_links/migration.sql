/*
  Warnings:

  - Added the required column `source` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('DOCUMENT', 'TEMPLATE', 'TEMPLATE_DIRECT_LINK');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "source" "DocumentSource",
ADD COLUMN     "templateId" INTEGER;

-- Custom: UpdateTable
UPDATE "Document" SET "source" = 'DOCUMENT' WHERE "source" IS NULL;

-- Custom: AlterColumn
ALTER TABLE "Document" ALTER COLUMN     "source" SET NOT NULL;

-- CreateTable
CREATE TABLE "TemplateDirectLink" (
    "id" TEXT NOT NULL,
    "templateId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabled" BOOLEAN NOT NULL,
    "directTemplateRecipientId" INTEGER NOT NULL,

    CONSTRAINT "TemplateDirectLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplateDirectLink_id_key" ON "TemplateDirectLink"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateDirectLink_templateId_key" ON "TemplateDirectLink"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateDirectLink_token_key" ON "TemplateDirectLink"("token");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateDirectLink" ADD CONSTRAINT "TemplateDirectLink_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
