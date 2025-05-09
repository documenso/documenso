/*
  Warnings:

  - You are about to drop the column `contractId` on the `Chat` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Chat" DROP CONSTRAINT "Chat_contractId_fkey";

-- AlterTable
ALTER TABLE "Chat" DROP COLUMN "contractId",
ADD COLUMN     "documentId" INTEGER;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
