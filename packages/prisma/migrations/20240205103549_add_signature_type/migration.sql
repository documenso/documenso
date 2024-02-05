-- CreateEnum
CREATE TYPE "SignatureType" AS ENUM ('DRAW', 'UPLOAD');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "signatureType" "SignatureType" NOT NULL DEFAULT 'DRAW';
