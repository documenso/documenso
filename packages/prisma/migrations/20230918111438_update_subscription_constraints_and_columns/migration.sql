/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - Made the column `customerId` on table `Subscription` required. This step will fail if there are existing NULL values in that column.

*/

DELETE FROM "Subscription"
WHERE "customerId" IS NULL;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "customerId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
