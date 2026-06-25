-- AlterTable
-- Add the new columns with temporary defaults to backfill existing rows, then
-- drop the defaults so the columns match the schema (required, no default).
ALTER TABLE "OrganisationClaim" ADD COLUMN     "apiQuota" INTEGER,
ADD COLUMN     "apiRateLimits" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN     "documentQuota" INTEGER,
ADD COLUMN     "documentRateLimits" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN     "emailQuota" INTEGER,
ADD COLUMN     "emailRateLimits" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN     "recipientCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "OrganisationClaim" ALTER COLUMN "apiRateLimits" DROP DEFAULT,
ALTER COLUMN "documentRateLimits" DROP DEFAULT,
ALTER COLUMN "emailRateLimits" DROP DEFAULT,
ALTER COLUMN "recipientCount" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SubscriptionClaim" ADD COLUMN     "apiQuota" INTEGER,
ADD COLUMN     "apiRateLimits" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN     "documentQuota" INTEGER,
ADD COLUMN     "documentRateLimits" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN     "emailQuota" INTEGER,
ADD COLUMN     "emailRateLimits" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN     "recipientCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SubscriptionClaim" ALTER COLUMN "apiRateLimits" DROP DEFAULT,
ALTER COLUMN "documentRateLimits" DROP DEFAULT,
ALTER COLUMN "emailRateLimits" DROP DEFAULT,
ALTER COLUMN "recipientCount" DROP DEFAULT;

-- CreateTable
CREATE TABLE "OrganisationMonthlyStat" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organisationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "documentCount" INTEGER NOT NULL DEFAULT 0,
    "emailCount" INTEGER NOT NULL DEFAULT 0,
    "apiCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrganisationMonthlyStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganisationMonthlyStat_organisationId_idx" ON "OrganisationMonthlyStat"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationMonthlyStat_organisationId_period_key" ON "OrganisationMonthlyStat"("organisationId", "period");

-- AddForeignKey
ALTER TABLE "OrganisationMonthlyStat" ADD CONSTRAINT "OrganisationMonthlyStat_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
