/*
  Warnings:

  - You are about to drop the column `description` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the column `documentName` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the column `templateDataId` on the `Template` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tempateDocumentDataId]` on the table `Template` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tempateDocumentDataId` to the `Template` table without a default value. This is not possible if the table is not empty.
  - Added the required column `inserted` to the `TemplateField` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Template" DROP CONSTRAINT "Template_templateDataId_fkey";

-- DropIndex
DROP INDEX "Template_templateDataId_key";

-- AlterTable
ALTER TABLE "Template" DROP COLUMN "description",
DROP COLUMN "documentName",
DROP COLUMN "status",
DROP COLUMN "templateDataId",
ADD COLUMN     "tempateDocumentDataId" TEXT NOT NULL,
ADD COLUMN     "type" "TemplateType" NOT NULL DEFAULT 'PRIVATE',
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TemplateField" ADD COLUMN     "inserted" BOOLEAN NOT NULL,
ADD COLUMN     "recipientId" INTEGER;

-- CreateTable
CREATE TABLE "TemplateRecipient" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "placeholder" VARCHAR(255) NOT NULL,

    CONSTRAINT "TemplateRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Template_tempateDocumentDataId_key" ON "Template"("tempateDocumentDataId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_tempateDocumentDataId_fkey" FOREIGN KEY ("tempateDocumentDataId") REFERENCES "DocumentData"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateRecipient" ADD CONSTRAINT "TemplateRecipient_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateField" ADD CONSTRAINT "TemplateField_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "TemplateRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
