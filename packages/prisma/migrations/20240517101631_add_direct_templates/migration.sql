/*
  Warnings:

  - Added the required column `source` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('DOCUMENT', 'TEMPLATE', 'TEMPLATE_DIRECT_ACCESS');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "source" "DocumentSource";

-- Custom: UpdateTable
UPDATE "Document" SET "source" = 'DOCUMENT' WHERE "source" IS NULL;

-- Custom: AlterColumn
ALTER TABLE "Document" ALTER COLUMN     "source" SET NOT NULL;

-- CreateTable
CREATE TABLE "TemplateDirectAccess" (
    "id" TEXT NOT NULL,
    "templateId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabled" BOOLEAN NOT NULL,
    "directTemplateRecipientId" INTEGER NOT NULL,

    CONSTRAINT "TemplateDirectAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplateDirectAccess_id_key" ON "TemplateDirectAccess"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateDirectAccess_templateId_key" ON "TemplateDirectAccess"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateDirectAccess_token_key" ON "TemplateDirectAccess"("token");

-- AddForeignKey
ALTER TABLE "TemplateDirectAccess" ADD CONSTRAINT "TemplateDirectAccess_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
