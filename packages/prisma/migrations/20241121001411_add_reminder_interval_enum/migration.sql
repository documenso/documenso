/*
  Warnings:

  - You are about to drop the column `reminderDays` on the `DocumentMeta` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ReminderInterval" AS ENUM ('NONE', 'EVERY_1_HOUR', 'EVERY_6_HOURS', 'EVERY_12_HOURS', 'DAILY', 'EVERY_3_DAYS', 'WEEKLY', 'EVERY_2_WEEKS', 'MONTHLY');

-- AlterTable
ALTER TABLE "DocumentMeta" DROP COLUMN "reminderDays",
ADD COLUMN     "reminderInterval" "ReminderInterval" NOT NULL DEFAULT 'NONE';
