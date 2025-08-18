-- AlterEnum
ALTER TYPE "SigningStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN     "expiryAmount" INTEGER,
ADD COLUMN     "expiryUnit" TEXT;

-- AlterTable
ALTER TABLE "TemplateMeta" ADD COLUMN     "defaultExpiryAmount" INTEGER,
ADD COLUMN     "defaultExpiryUnit" TEXT;
