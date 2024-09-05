-- AlterTable
ALTER TABLE "TeamEmailVerification" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TeamTransferVerification" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "VerificationToken" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false;
