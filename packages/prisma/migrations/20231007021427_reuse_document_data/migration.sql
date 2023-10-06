/*
  Warnings:

  - You are about to drop the `TemplateData` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Template" DROP CONSTRAINT "Template_templateDataId_fkey";

-- DropTable
DROP TABLE "TemplateData";

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_templateDataId_fkey" FOREIGN KEY ("templateDataId") REFERENCES "DocumentData"("id") ON DELETE CASCADE ON UPDATE CASCADE;
