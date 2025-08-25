-- CreateEnum
CREATE TYPE "DocumentReminderInterval" AS ENUM ('NONE', 'EVERY_1_HOUR', 'EVERY_6_HOURS', 'EVERY_12_HOURS', 'DAILY', 'EVERY_3_DAYS', 'WEEKLY', 'EVERY_2_WEEKS', 'MONTHLY');

-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN     "lastReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "reminderInterval" "DocumentReminderInterval" NOT NULL DEFAULT 'NONE';
