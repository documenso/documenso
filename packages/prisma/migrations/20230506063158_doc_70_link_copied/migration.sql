/*
  Warnings:

  - The values [COPIED] on the enum `SendStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SendStatus_new" AS ENUM ('NOT_SENT', 'SENT', 'LINK_COPIED');
ALTER TABLE "Recipient" ALTER COLUMN "sendStatus" DROP DEFAULT;
ALTER TABLE "Recipient" ALTER COLUMN "sendStatus" TYPE "SendStatus_new" USING ("sendStatus"::text::"SendStatus_new");
ALTER TYPE "SendStatus" RENAME TO "SendStatus_old";
ALTER TYPE "SendStatus_new" RENAME TO "SendStatus";
DROP TYPE "SendStatus_old";
ALTER TABLE "Recipient" ALTER COLUMN "sendStatus" SET DEFAULT 'NOT_SENT';
COMMIT;
