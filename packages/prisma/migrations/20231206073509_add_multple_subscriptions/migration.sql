/*
  Warnings:

  - A unique constraint covering the columns `[planId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[customerId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Made the column `planId` on table `Subscription` required. This step will fail if there are existing NULL values in that column.
  - Made the column `priceId` on table `Subscription` required. This step will fail if there are existing NULL values in that column.

*/
-- Custom migration statement
DELETE FROM "Subscription" WHERE "planId" IS NULL OR "priceId" IS NULL;

-- DropIndex
DROP INDEX "Subscription_customerId_key";

-- DropIndex
DROP INDEX "Subscription_userId_key";

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "planId" SET NOT NULL,
ALTER COLUMN "priceId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "customerId" TEXT;
ALTER TABLE "Subscription" DROP COLUMN "customerId";

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_planId_key" ON "Subscription"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "User_customerId_key" ON "User"("customerId");
