-- DropForeignKey
ALTER TABLE "DocumentData" DROP CONSTRAINT "DocumentData_documentId_fkey";

-- DropIndex
DROP INDEX "DocumentData_documentId_key";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "documentDataId" TEXT;

-- Reverse relation foreign key ids
UPDATE "Document" SET "documentDataId" = "DocumentData"."id" FROM "DocumentData" WHERE "Document"."id" = "DocumentData"."documentId";

-- AlterColumn
ALTER TABLE "Document" ALTER COLUMN "documentDataId" SET NOT NULL;

-- AlterTable
ALTER TABLE "DocumentData" DROP COLUMN "documentId";

-- CreateIndex
CREATE UNIQUE INDEX "Document_documentDataId_key" ON "Document"("documentDataId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_documentDataId_fkey" FOREIGN KEY ("documentDataId") REFERENCES "DocumentData"("id") ON DELETE CASCADE ON UPDATE CASCADE;
