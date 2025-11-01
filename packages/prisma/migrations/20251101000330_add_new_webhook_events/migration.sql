-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WebhookTriggerEvents" ADD VALUE 'DOCUMENT_VIEWED';
ALTER TYPE "WebhookTriggerEvents" ADD VALUE 'DOCUMENT_RECIPIENT_COMPLETED';
ALTER TYPE "WebhookTriggerEvents" ADD VALUE 'DOCUMENT_DOWNLOADED';
ALTER TYPE "WebhookTriggerEvents" ADD VALUE 'DOCUMENT_REMINDER_SENT';
ALTER TYPE "WebhookTriggerEvents" ADD VALUE 'TEMPLATE_CREATED';
ALTER TYPE "WebhookTriggerEvents" ADD VALUE 'TEMPLATE_UPDATED';
ALTER TYPE "WebhookTriggerEvents" ADD VALUE 'TEMPLATE_DELETED';
ALTER TYPE "WebhookTriggerEvents" ADD VALUE 'TEMPLATE_USED';
ALTER TYPE "WebhookTriggerEvents" ADD VALUE 'RECIPIENT_AUTHENTICATION_FAILED';
