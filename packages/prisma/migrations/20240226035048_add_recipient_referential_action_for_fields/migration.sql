-- DropForeignKey
ALTER TABLE "Field" DROP CONSTRAINT "Field_recipientId_fkey";

-- AddForeignKey
ALTER TABLE "Field" ADD CONSTRAINT "Field_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
