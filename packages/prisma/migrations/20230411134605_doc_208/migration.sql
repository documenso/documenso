-- DropForeignKey
ALTER TABLE "Signature" DROP CONSTRAINT "Signature_recipientId_fkey";

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
