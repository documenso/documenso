/*
  Warnings:

  - Made the column `recipientId` on table `Field` required. This step will fail if there are existing NULL values in that column.

*/
-- Drop all Fields where the recipientId is null
DELETE FROM "Field" WHERE "recipientId" IS NULL;

-- AlterTable
ALTER TABLE "Field" ALTER COLUMN "recipientId" SET NOT NULL;
