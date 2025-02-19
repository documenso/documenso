/*
  Warnings:

  - You are about to drop the column `includeAuditTrail` on the `Document` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Document" DROP COLUMN "includeAuditTrail",
ADD COLUMN     "includeAuditTrailLog" BOOLEAN NOT NULL DEFAULT false;
