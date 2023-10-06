/*
  Warnings:

  - Added the required column `token` to the `TemplateRecipient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TemplateRecipient" ADD COLUMN     "token" TEXT NOT NULL;
