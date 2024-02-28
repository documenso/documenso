/*
  Warnings:

  - The primary key for the `Webhook` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "Webhook" DROP CONSTRAINT "Webhook_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Webhook_id_seq";
