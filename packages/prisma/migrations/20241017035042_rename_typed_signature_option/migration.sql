/*
  Warnings:

  - You are about to drop the column `enabledTypedSignature` on the `DocumentMeta` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DocumentMeta" DROP COLUMN "enabledTypedSignature",
ADD COLUMN     "typedSignatureEnabled" BOOLEAN NOT NULL DEFAULT false;
