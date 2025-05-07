-- DropForeignKey
ALTER TABLE "OrganisationGroupMember" DROP CONSTRAINT "OrganisationGroupMember_organisationMemberId_fkey";

-- AddForeignKey
ALTER TABLE "OrganisationGroupMember" ADD CONSTRAINT "OrganisationGroupMember_organisationMemberId_fkey" FOREIGN KEY ("organisationMemberId") REFERENCES "OrganisationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
