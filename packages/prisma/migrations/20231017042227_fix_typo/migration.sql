/*
  Warnings:

  - You are about to drop the column `tempateDocumentDataId` on the `Template` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[templateDocumentDataId]` on the table `Template` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `templateDocumentDataId` to the `Template` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Template" DROP CONSTRAINT "Template_tempateDocumentDataId_fkey";

-- DropIndex
DROP INDEX "Template_tempateDocumentDataId_key";

-- AlterTable
ALTER TABLE "Template" DROP COLUMN "tempateDocumentDataId",
ADD COLUMN     "templateDocumentDataId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Template_templateDocumentDataId_key" ON "Template"("templateDocumentDataId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_templateDocumentDataId_fkey" FOREIGN KEY ("templateDocumentDataId") REFERENCES "DocumentData"("id") ON DELETE CASCADE ON UPDATE CASCADE;
