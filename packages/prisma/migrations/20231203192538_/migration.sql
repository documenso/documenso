/*
  Warnings:

  - A unique constraint covering the columns `[documentThumbnailId]` on the table `Document` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "documentThumbnailId" TEXT;

-- CreateTable
CREATE TABLE "DocumentThumbnail" (
    "id" TEXT NOT NULL,
    "thumbnail_bytes" BYTEA NOT NULL,
    "hq_thumbnail_bytes" BYTEA NOT NULL,

    CONSTRAINT "DocumentThumbnail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_documentThumbnailId_key" ON "Document"("documentThumbnailId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_documentThumbnailId_fkey" FOREIGN KEY ("documentThumbnailId") REFERENCES "DocumentThumbnail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
