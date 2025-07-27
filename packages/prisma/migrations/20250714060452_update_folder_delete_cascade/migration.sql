-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_folderId_fkey";

-- DropForeignKey
ALTER TABLE "Template" DROP CONSTRAINT "Template_folderId_fkey";

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
