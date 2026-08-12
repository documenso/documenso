-- DropForeignKey
ALTER TABLE "DocumentAuditLog" DROP CONSTRAINT "DocumentAuditLog_envelopeId_fkey";

-- AlterTable
ALTER TABLE "DocumentAuditLog" ALTER COLUMN "envelopeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "DocumentAuditLog" ADD CONSTRAINT "DocumentAuditLog_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE SET NULL ON UPDATE CASCADE;
