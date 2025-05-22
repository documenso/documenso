/*
  Warnings:

  - You are about to drop the column `brandingHidePoweredBy` on the `OrganisationGlobalSettings` table. All the data in the column will be lost.
  - You are about to drop the column `customerId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `brandingHidePoweredBy` on the `TeamGlobalSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" DROP COLUMN "brandingHidePoweredBy";

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "customerId";

-- AlterTable
ALTER TABLE "TeamGlobalSettings" DROP COLUMN "brandingHidePoweredBy";
