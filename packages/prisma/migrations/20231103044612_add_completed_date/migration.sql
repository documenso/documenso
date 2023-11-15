-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "completedAt" TIMESTAMP(3);

UPDATE "Document" SET "completedAt" = "updatedAt" WHERE "status" = 'COMPLETED';
