/*
  Warnings:

  - You are about to drop the column `teamId` on the `OrganisationMemberInvite` table. All the data in the column will be lost.
  - You are about to drop the column `teamRole` on the `OrganisationMemberInvite` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[teamId,organisationGroupId]` on the table `TeamGroup` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "OrganisationMemberInvite" DROP CONSTRAINT "OrganisationMemberInvite_teamId_fkey";

-- AlterTable
ALTER TABLE "OrganisationMemberInvite" DROP COLUMN "teamId",
DROP COLUMN "teamRole";

-- CreateIndex
CREATE UNIQUE INDEX "TeamGroup_teamId_organisationGroupId_key" ON "TeamGroup"("teamId", "organisationGroupId");
