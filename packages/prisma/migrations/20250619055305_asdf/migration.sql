/*
  Warnings:

  - Added the required column `publicKey` to the `EmailDomain` table without a default value. This is not possible if the table is not empty.
  - Added the required column `emailName` to the `OrganisationEmail` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EmailDomain" ADD COLUMN     "publicKey" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OrganisationEmail" ADD COLUMN     "emailName" TEXT NOT NULL;
