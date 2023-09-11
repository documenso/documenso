/*
  Warnings:

  - Added the required column `name` to the `DocumentContent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DocumentContent" ADD COLUMN     "name" TEXT NOT NULL;
