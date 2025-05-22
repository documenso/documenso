/*
  Warnings:

  - You are about to drop the column `settingsId` on the `Organisation` table. All the data in the column will be lost.
  - You are about to drop the column `settingsId` on the `Team` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[organisationGlobalSettingsId]` on the table `Organisation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[teamGlobalSettingsId]` on the table `Team` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organisationGlobalSettingsId` to the `Organisation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `teamGlobalSettingsId` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Organisation" DROP CONSTRAINT "Organisation_settingsId_fkey";

-- DropForeignKey
ALTER TABLE "Team" DROP CONSTRAINT "Team_settingsId_fkey";

-- DropIndex
DROP INDEX "Organisation_settingsId_key";

-- DropIndex
DROP INDEX "Team_settingsId_key";

-- AlterTable
ALTER TABLE "Organisation" DROP COLUMN "settingsId",
ADD COLUMN     "organisationGlobalSettingsId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Team" DROP COLUMN "settingsId",
ADD COLUMN     "teamGlobalSettingsId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_organisationGlobalSettingsId_key" ON "Organisation"("organisationGlobalSettingsId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_teamGlobalSettingsId_key" ON "Team"("teamGlobalSettingsId");

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_organisationGlobalSettingsId_fkey" FOREIGN KEY ("organisationGlobalSettingsId") REFERENCES "OrganisationGlobalSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_teamGlobalSettingsId_fkey" FOREIGN KEY ("teamGlobalSettingsId") REFERENCES "TeamGlobalSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
