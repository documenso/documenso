-- AlterEnum
ALTER TYPE "SigningStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Recipient" ADD COLUMN     "rejectionReason" TEXT;
