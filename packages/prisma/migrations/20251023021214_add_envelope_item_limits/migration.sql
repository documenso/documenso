-- AlterTable
ALTER TABLE "SubscriptionClaim" ADD COLUMN     "envelopeItemCount" INTEGER;
ALTER TABLE "OrganisationClaim" ADD COLUMN     "envelopeItemCount" INTEGER;

-- Update ALL subscriptions to have 5 envelope items
UPDATE "SubscriptionClaim" SET "envelopeItemCount" = 5;

-- Override platform and enterprise claims to have 10 envelope items
UPDATE "SubscriptionClaim" SET "envelopeItemCount" = 10 WHERE "id" = 'platform';
UPDATE "SubscriptionClaim" SET "envelopeItemCount" = 10 WHERE "id" = 'enterprise';

-- Update ALL organisations to have 5 envelope items
UPDATE "OrganisationClaim" SET "envelopeItemCount" = 5;

-- Override platform and enterprise organisations to have 10 envelope items
UPDATE "OrganisationClaim" SET "envelopeItemCount" = 10 WHERE "originalSubscriptionClaimId" = 'platform';
UPDATE "OrganisationClaim" SET "envelopeItemCount" = 10 WHERE "originalSubscriptionClaimId" = 'enterprise';

ALTER TABLE "SubscriptionClaim" ALTER COLUMN "envelopeItemCount" SET NOT NULL;
ALTER TABLE "OrganisationClaim" ALTER COLUMN "envelopeItemCount" SET NOT NULL;
