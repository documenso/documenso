-- AlterEnum
ALTER TYPE "WebhookTriggerEvents" ADD VALUE 'RECIPIENT_EXPIRED';

-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN     "envelopeExpirationPeriod" JSONB;

-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "envelopeExpirationPeriod" JSONB;

-- AlterTable
ALTER TABLE "Recipient" ADD COLUMN     "expirationNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "envelopeExpirationPeriod" JSONB;

-- CreateIndex
CREATE INDEX "Recipient_expiresAt_idx" ON "Recipient"("expiresAt");
