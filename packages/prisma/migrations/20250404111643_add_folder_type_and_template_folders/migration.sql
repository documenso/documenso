/*
  Warnings:

  - Added the required column `type` to the `Folder` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FolderType" AS ENUM ('DOCUMENT', 'TEMPLATE');

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "type" "FolderType" NOT NULL;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "folderId" TEXT;

-- CreateIndex
CREATE INDEX "Folder_type_idx" ON "Folder"("type");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
