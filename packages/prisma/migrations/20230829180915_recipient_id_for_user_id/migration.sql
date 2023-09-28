/*
  Warnings:

  - You are about to drop the column `userId` on the `Share` table. All the data in the column will be lost.
  - Added the required column `recipientId` to the `Share` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Share" DROP CONSTRAINT "Share_userId_fkey";

-- AlterTable
ALTER TABLE "Share" DROP COLUMN "userId",
ADD COLUMN     "recipientId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
