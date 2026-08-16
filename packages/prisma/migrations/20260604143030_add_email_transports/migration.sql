-- CreateEnum
CREATE TYPE "EmailTransportType" AS ENUM ('SMTP_AUTH', 'SMTP_API', 'RESEND', 'MAILCHANNELS');

-- AlterTable
ALTER TABLE "OrganisationClaim" ADD COLUMN     "emailTransportId" TEXT;

-- AlterTable
ALTER TABLE "SubscriptionClaim" ADD COLUMN     "emailTransportId" TEXT;

-- CreateTable
CREATE TABLE "EmailTransport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EmailTransportType" NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "config" TEXT NOT NULL,

    CONSTRAINT "EmailTransport_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SubscriptionClaim" ADD CONSTRAINT "SubscriptionClaim_emailTransportId_fkey" FOREIGN KEY ("emailTransportId") REFERENCES "EmailTransport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationClaim" ADD CONSTRAINT "OrganisationClaim_emailTransportId_fkey" FOREIGN KEY ("emailTransportId") REFERENCES "EmailTransport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
