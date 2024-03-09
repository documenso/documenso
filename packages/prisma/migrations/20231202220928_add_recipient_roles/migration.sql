-- CreateEnum
CREATE TYPE "RecipientRole" AS ENUM ('CC', 'SIGNER', 'VIEWER', 'APPROVER');

-- AlterTable
ALTER TABLE "Recipient" ADD COLUMN     "role" "RecipientRole" NOT NULL DEFAULT 'SIGNER';
