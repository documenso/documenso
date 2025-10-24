-- AlterTable
ALTER TABLE "SubscriptionClaim" ADD COLUMN     "envelopeItemCount" INTEGER;
ALTER TABLE "OrganisationClaim" ADD COLUMN     "envelopeItemCount" INTEGER;

UPDATE "SubscriptionClaim" SET "envelopeItemCount" = 5 WHERE "id" = 'free';
UPDATE "SubscriptionClaim" SET "envelopeItemCount" = 5 WHERE "id" = 'individual';
UPDATE "SubscriptionClaim" SET "envelopeItemCount" = 5 WHERE "id" = 'team';
UPDATE "SubscriptionClaim" SET "envelopeItemCount" = 5 WHERE "id" = 'earlyAdopter';
UPDATE "SubscriptionClaim" SET "envelopeItemCount" = 10 WHERE "id" = 'platform';
UPDATE "SubscriptionClaim" SET "envelopeItemCount" = 10 WHERE "id" = 'enterprise';

UPDATE "OrganisationClaim" SET "envelopeItemCount" = 5 WHERE "originalSubscriptionClaimId" = 'free';
UPDATE "OrganisationClaim" SET "envelopeItemCount" = 5 WHERE "originalSubscriptionClaimId" = 'individual';
UPDATE "OrganisationClaim" SET "envelopeItemCount" = 5 WHERE "originalSubscriptionClaimId" = 'team';
UPDATE "OrganisationClaim" SET "envelopeItemCount" = 5 WHERE "originalSubscriptionClaimId" = 'earlyAdopter';
UPDATE "OrganisationClaim" SET "envelopeItemCount" = 10 WHERE "originalSubscriptionClaimId" = 'platform';
UPDATE "OrganisationClaim" SET "envelopeItemCount" = 10 WHERE "originalSubscriptionClaimId" = 'enterprise';

ALTER TABLE "SubscriptionClaim" ALTER COLUMN "envelopeItemCount" SET NOT NULL;
ALTER TABLE "OrganisationClaim" ALTER COLUMN "envelopeItemCount" SET NOT NULL;
