-- CreateTable
CREATE TABLE "OrganisationDomainAccess" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationDomainAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationDomainAccess_organisationId_domain_key" ON "OrganisationDomainAccess"("organisationId", "domain");

-- CreateIndex
CREATE INDEX "OrganisationDomainAccess_domain_idx" ON "OrganisationDomainAccess"("domain");

-- CreateIndex
CREATE INDEX "OrganisationDomainAccess_organisationId_idx" ON "OrganisationDomainAccess"("organisationId");

-- CreateIndex
CREATE INDEX "OrganisationDomainAccess_createdAt_idx" ON "OrganisationDomainAccess"("createdAt");

-- AddForeignKey
ALTER TABLE "OrganisationDomainAccess" ADD CONSTRAINT "OrganisationDomainAccess_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "OrganisationMember_organisationId_idx" ON "OrganisationMember"("organisationId");

-- CreateIndex
CREATE INDEX "OrganisationMember_userId_idx" ON "OrganisationMember"("userId");