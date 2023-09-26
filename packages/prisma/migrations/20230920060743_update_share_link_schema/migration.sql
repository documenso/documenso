/*
  Warnings:

  - You are about to drop the `Share` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Share" DROP CONSTRAINT "Share_documentId_fkey";

-- DropForeignKey
ALTER TABLE "Share" DROP CONSTRAINT "Share_recipientId_fkey";

-- DropTable
DROP TABLE "Share";

-- CreateTable
CREATE TABLE "DocumentShareLink" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "documentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentShareLink_slug_key" ON "DocumentShareLink"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentShareLink_documentId_email_key" ON "DocumentShareLink"("documentId", "email");

-- AddForeignKey
ALTER TABLE "DocumentShareLink" ADD CONSTRAINT "DocumentShareLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
