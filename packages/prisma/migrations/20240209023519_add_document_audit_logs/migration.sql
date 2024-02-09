/*
  Warnings:

  - A unique constraint covering the columns `[secondaryId]` on the table `Field` will be added. If there are existing duplicate values, this will fail.
  - The required column `secondaryId` was added to the `Field` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "Field" ADD COLUMN     "secondaryId" TEXT;

-- Set all null secondaryId fields to a uuid
UPDATE "Field" SET "secondaryId" = gen_random_uuid()::text WHERE "secondaryId" IS NULL;

-- Restrict the Field to required
ALTER TABLE "Field" ALTER COLUMN "secondaryId" SET NOT NULL;

-- CreateTable
CREATE TABLE "DocumentAuditLog" (
    "id" TEXT NOT NULL,
    "documentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "userId" INTEGER,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "DocumentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Field_secondaryId_key" ON "Field"("secondaryId");

-- AddForeignKey
ALTER TABLE "DocumentAuditLog" ADD CONSTRAINT "DocumentAuditLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
