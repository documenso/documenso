/*
  Warnings:

  - Made the column `organisationMemberId` on table `OrganisationGroupMember` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "OrganisationGroupMember" DROP CONSTRAINT "OrganisationGroupMember_organisationMemberId_fkey";

-- AlterTable
ALTER TABLE "OrganisationGroupMember" ALTER COLUMN "organisationMemberId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "OrganisationGroupMember" ADD CONSTRAINT "OrganisationGroupMember_organisationMemberId_fkey" FOREIGN KEY ("organisationMemberId") REFERENCES "OrganisationMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
