-- CreateEnum
CREATE TYPE "AnonymousVerificationTokenType" AS ENUM ('PASSKEY', 'QR_SIGNATURE');

-- AlterTable: add "type" as nullable, backfill existing rows (all are passkey
-- challenges today), then enforce NOT NULL.
ALTER TABLE "AnonymousVerificationToken" ADD COLUMN "type" "AnonymousVerificationTokenType";

UPDATE "AnonymousVerificationToken" SET "type" = 'PASSKEY';

ALTER TABLE "AnonymousVerificationToken" ALTER COLUMN "type" SET NOT NULL;

-- AlterTable
ALTER TABLE "AnonymousVerificationToken" ADD COLUMN "value" TEXT;

ALTER TABLE "AnonymousVerificationToken" ADD COLUMN "metadata" JSONB;
