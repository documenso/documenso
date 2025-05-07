/*
  Warnings:

  - You are about to drop the column `teamId` on the `TeamGlobalSettings` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[settingsId]` on the table `Organisation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[settingsId]` on the table `Team` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `settingsId` to the `Organisation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `settingsId` to the `Team` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `TeamGlobalSettings` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "TeamGlobalSettings" DROP CONSTRAINT "TeamGlobalSettings_teamId_fkey";

-- DropIndex
DROP INDEX "TeamGlobalSettings_teamId_key";

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "settingsId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "settingsId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" DROP COLUMN "teamId",
ADD COLUMN     "id" TEXT NOT NULL,
ALTER COLUMN "documentVisibility" DROP NOT NULL,
ALTER COLUMN "documentVisibility" DROP DEFAULT,
ALTER COLUMN "includeSenderDetails" DROP NOT NULL,
ALTER COLUMN "includeSenderDetails" DROP DEFAULT,
ALTER COLUMN "brandingCompanyDetails" DROP NOT NULL,
ALTER COLUMN "brandingCompanyDetails" DROP DEFAULT,
ALTER COLUMN "brandingEnabled" DROP NOT NULL,
ALTER COLUMN "brandingEnabled" DROP DEFAULT,
ALTER COLUMN "brandingHidePoweredBy" DROP NOT NULL,
ALTER COLUMN "brandingHidePoweredBy" DROP DEFAULT,
ALTER COLUMN "brandingLogo" DROP NOT NULL,
ALTER COLUMN "brandingLogo" DROP DEFAULT,
ALTER COLUMN "brandingUrl" DROP NOT NULL,
ALTER COLUMN "brandingUrl" DROP DEFAULT,
ALTER COLUMN "documentLanguage" DROP NOT NULL,
ALTER COLUMN "documentLanguage" DROP DEFAULT,
ALTER COLUMN "typedSignatureEnabled" DROP NOT NULL,
ALTER COLUMN "typedSignatureEnabled" DROP DEFAULT,
ALTER COLUMN "includeSigningCertificate" DROP NOT NULL,
ALTER COLUMN "includeSigningCertificate" DROP DEFAULT,
ALTER COLUMN "drawSignatureEnabled" DROP NOT NULL,
ALTER COLUMN "drawSignatureEnabled" DROP DEFAULT,
ALTER COLUMN "uploadSignatureEnabled" DROP NOT NULL,
ALTER COLUMN "uploadSignatureEnabled" DROP DEFAULT,
ADD CONSTRAINT "TeamGlobalSettings_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "OrganisationGlobalSettings" (
    "id" TEXT NOT NULL,
    "documentVisibility" "DocumentVisibility" NOT NULL DEFAULT 'EVERYONE',
    "documentLanguage" TEXT NOT NULL DEFAULT 'en',
    "includeSenderDetails" BOOLEAN NOT NULL DEFAULT true,
    "includeSigningCertificate" BOOLEAN NOT NULL DEFAULT true,
    "typedSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "uploadSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "drawSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "brandingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "brandingLogo" TEXT NOT NULL DEFAULT '',
    "brandingUrl" TEXT NOT NULL DEFAULT '',
    "brandingCompanyDetails" TEXT NOT NULL DEFAULT '',
    "brandingHidePoweredBy" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrganisationGlobalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_settingsId_key" ON "Organisation"("settingsId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_settingsId_key" ON "Team"("settingsId");

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "OrganisationGlobalSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "TeamGlobalSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
