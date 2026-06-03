-- AlterTable
ALTER TABLE "User" ADD COLUMN "department" TEXT;
ALTER TABLE "User" ADD COLUMN "title" TEXT;
ALTER TABLE "User" ADD COLUMN "orgUnitPath" TEXT;
ALTER TABLE "User" ADD COLUMN "googleGroups" JSONB;
ALTER TABLE "User" ADD COLUMN "directoryLastSyncedAt" TIMESTAMP(3);
