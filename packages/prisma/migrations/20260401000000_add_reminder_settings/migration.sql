-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN     "reminderSettings" JSONB;

-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "reminderSettings" JSONB;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "reminderSettings" JSONB;

-- AlterTable
ALTER TABLE "Recipient" ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "lastReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "nextReminderAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Recipient_nextReminderAt_idx" ON "Recipient"("nextReminderAt");
