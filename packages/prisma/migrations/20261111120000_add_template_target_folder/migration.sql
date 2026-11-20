-- AlterTable
ALTER TABLE "Envelope" ADD COLUMN     "targetFolderId" TEXT;

-- CreateIndex
CREATE INDEX "Envelope_targetFolderId_idx" ON "Envelope"("targetFolderId");

-- AddForeignKey
ALTER TABLE "Envelope" ADD CONSTRAINT "Envelope_targetFolderId_fkey" FOREIGN KEY ("targetFolderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
