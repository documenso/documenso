/*
  Warnings:

  - You are about to drop the column `verifiedAt` on the `EmailDomain` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[selector]` on the table `EmailDomain` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `selector` to the `EmailDomain` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EmailDomain" DROP COLUMN "verifiedAt",
ADD COLUMN     "selector" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "OrganisationEmail" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "replyTo" TEXT,
    "emailDomainId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,

    CONSTRAINT "OrganisationEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationEmail_email_key" ON "OrganisationEmail"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDomain_selector_key" ON "EmailDomain"("selector");

-- AddForeignKey
ALTER TABLE "OrganisationEmail" ADD CONSTRAINT "OrganisationEmail_emailDomainId_fkey" FOREIGN KEY ("emailDomainId") REFERENCES "EmailDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationEmail" ADD CONSTRAINT "OrganisationEmail_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
