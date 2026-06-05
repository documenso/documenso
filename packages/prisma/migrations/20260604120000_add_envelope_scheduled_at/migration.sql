-- AlterTable
ALTER TABLE "Envelope" ADD COLUMN "scheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Envelope_scheduledAt_idx" ON "Envelope"("scheduledAt");
