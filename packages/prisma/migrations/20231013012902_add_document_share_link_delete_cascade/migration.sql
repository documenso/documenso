-- DropForeignKey
ALTER TABLE "DocumentShareLink" DROP CONSTRAINT "DocumentShareLink_documentId_fkey";

-- AddForeignKey
ALTER TABLE "DocumentShareLink" ADD CONSTRAINT "DocumentShareLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
