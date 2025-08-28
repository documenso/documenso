/*
  Warnings:

  - You are about to drop the column `qrToken` on the `Document` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Document" DROP COLUMN "qrToken";

-- AlterTable
ALTER TABLE "Envelope" ADD COLUMN     "qrToken" TEXT;
