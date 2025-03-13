-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "includeAuditTrail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "includeSigningCertificate" BOOLEAN NOT NULL DEFAULT true;
