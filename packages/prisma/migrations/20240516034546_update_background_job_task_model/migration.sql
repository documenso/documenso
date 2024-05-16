/*
  Warnings:

  - Added the required column `name` to the `BackgroundJobTask` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BackgroundJobTask" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "name" TEXT NOT NULL;
