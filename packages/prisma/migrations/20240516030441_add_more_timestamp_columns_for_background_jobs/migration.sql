/*
  Warnings:

  - Added the required column `updatedAt` to the `BackgroundJob` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BackgroundJob" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
