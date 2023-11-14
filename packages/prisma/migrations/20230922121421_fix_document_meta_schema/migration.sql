/*
  Warnings:

  - You are about to drop the column `documentMetaId` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `customEmailBody` on the `DocumentMeta` table. All the data in the column will be lost.
  - You are about to drop the column `customEmailSubject` on the `DocumentMeta` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[documentId]` on the table `DocumentMeta` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `documentId` to the `DocumentMeta` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_documentMetaId_fkey";

-- DropIndex
DROP INDEX "Document_documentMetaId_key";

-- AlterTable
ALTER TABLE "DocumentMeta"
ADD COLUMN     "documentId" INTEGER,
ADD COLUMN     "message" TEXT,
ADD COLUMN     "subject" TEXT;

-- Migrate data
UPDATE "DocumentMeta" SET "documentId" = (
  SELECT "id" FROM "Document" WHERE "Document"."documentMetaId" = "DocumentMeta"."id"
);

-- Migrate data
UPDATE "DocumentMeta" SET "message" = "customEmailBody";

-- Migrate data
UPDATE "DocumentMeta" SET "subject" = "customEmailSubject";

-- Prune data
DELETE FROM "DocumentMeta" WHERE "documentId" IS NULL;

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "documentMetaId";

-- AlterTable
ALTER TABLE "DocumentMeta" 
DROP COLUMN "customEmailBody",
DROP COLUMN "customEmailSubject";

-- AlterColumn
ALTER TABLE "DocumentMeta" ALTER COLUMN "documentId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DocumentMeta_documentId_key" ON "DocumentMeta"("documentId");

-- AddForeignKey
ALTER TABLE "DocumentMeta" ADD CONSTRAINT "DocumentMeta_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
