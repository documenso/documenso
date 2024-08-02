-- CreateEnum
CREATE TYPE "DocumentSigningOrder" AS ENUM ('PARALLEL', 'SEQUENTIAL');

-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN     "signingOrder" "DocumentSigningOrder" NOT NULL DEFAULT 'PARALLEL';
