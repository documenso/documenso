/*
  Warnings:

  - A unique constraint covering the columns `[documentMetaId]` on the table `Document` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Document_documentMetaId_key" ON "Document"("documentMetaId");
