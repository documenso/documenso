-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN     "lastReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "reminderSettings" JSONB;

-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "reminderSettings" JSONB;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "reminderSettings" JSONB;
