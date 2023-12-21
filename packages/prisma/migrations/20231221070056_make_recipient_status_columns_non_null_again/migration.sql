/*
  Warnings:

  - Made the column `readStatus` on table `Recipient` required. This step will fail if there are existing NULL values in that column.
  - Made the column `signingStatus` on table `Recipient` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sendStatus` on table `Recipient` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Recipient" ALTER COLUMN "readStatus" SET NOT NULL,
ALTER COLUMN "signingStatus" SET NOT NULL,
ALTER COLUMN "sendStatus" SET NOT NULL;
