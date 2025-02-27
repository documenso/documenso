-- DropIndex
DROP INDEX "Recipient_templateId_email_key";

-- CreateIndex
CREATE INDEX "Recipient_email_idx" ON "Recipient"("email");
