-- AlterTable
ALTER TABLE "SubscriptionClaim" ADD COLUMN     "envelopeContentCount" INTEGER,
ADD COLUMN     "envelopeContentImageCount" INTEGER;

-- AlterTable
ALTER TABLE "OrganisationClaim" ADD COLUMN     "envelopeContentCount" INTEGER,
ADD COLUMN     "envelopeContentImageCount" INTEGER;

-- Backfill every existing claim as unlimited (0).
UPDATE "SubscriptionClaim" SET "envelopeContentCount" = 0, "envelopeContentImageCount" = 0;
UPDATE "OrganisationClaim" SET "envelopeContentCount" = 0, "envelopeContentImageCount" = 0;

-- AlterTable
ALTER TABLE "SubscriptionClaim" ALTER COLUMN "envelopeContentCount" SET NOT NULL,
ALTER COLUMN "envelopeContentImageCount" SET NOT NULL;

-- AlterTable
ALTER TABLE "OrganisationClaim" ALTER COLUMN "envelopeContentCount" SET NOT NULL,
ALTER COLUMN "envelopeContentImageCount" SET NOT NULL;
