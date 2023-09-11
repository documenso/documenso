/*
  Warnings:

  - You are about to drop the `DocumentContent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Template` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Template" DROP CONSTRAINT "Template_documentId_fkey";

-- DropForeignKey
ALTER TABLE "Template" DROP CONSTRAINT "Template_ownerId_fkey";

-- DropTable
DROP TABLE "DocumentContent";

-- DropTable
DROP TABLE "Template";

-- DropEnum
DROP TYPE "TemplateType";
