/*
  Warnings:

  - You are about to drop the column `customerId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `TeamPending` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[organisationClaimId]` on the table `Organisation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organisationId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organisationClaimId` to the `Organisation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_organisationId_fkey";

-- DropForeignKey
ALTER TABLE "TeamPending" DROP CONSTRAINT "TeamPending_ownerUserId_fkey";

-- DropIndex
DROP INDEX "User_customerId_key";

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "organisationClaimId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "customerId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "customerId";

-- DropTable
DROP TABLE "TeamPending";

-- CreateTable
CREATE TABLE "SubscriptionClaim" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "teamCount" INTEGER NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "flags" JSONB NOT NULL,

    CONSTRAINT "SubscriptionClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationClaim" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "originalSubscriptionClaimId" TEXT,
    "teamCount" INTEGER NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "flags" JSONB NOT NULL,

    CONSTRAINT "OrganisationClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_organisationClaimId_key" ON "Organisation"("organisationClaimId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organisationId_key" ON "Subscription"("organisationId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_organisationClaimId_fkey" FOREIGN KEY ("organisationClaimId") REFERENCES "OrganisationClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
