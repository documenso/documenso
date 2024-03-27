/*
  Warnings:

  - A unique constraint covering the columns `[secondaryId]` on the table `VerificationToken` will be added. If there are existing duplicate values, this will fail.
  - The required column `secondaryId` was added to the `VerificationToken` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "VerificationToken" ADD COLUMN     "secondaryId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_secondaryId_key" ON "VerificationToken"("secondaryId");
