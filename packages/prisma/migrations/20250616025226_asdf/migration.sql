/*
  Warnings:

  - Added the required column `privateKey` to the `EmailDomain` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EmailDomain" ADD COLUMN     "privateKey" TEXT NOT NULL;
