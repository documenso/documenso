-- CreateEnum
CREATE TYPE "DocumentBodyExtractedStatus" AS ENUM ('ERROR', 'PENDING', 'COMPLETED', 'PROCESSING');

-- CreateTable
CREATE TABLE "DocumentBodyExtracted" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "documentId" INTEGER NOT NULL,

    CONSTRAINT "DocumentBodyExtracted_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentBodyExtracted_documentId_key" ON "DocumentBodyExtracted"("documentId");

-- AddForeignKey
ALTER TABLE "DocumentBodyExtracted" ADD CONSTRAINT "DocumentBodyExtracted_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
