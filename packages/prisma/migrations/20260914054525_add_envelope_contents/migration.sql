-- The claim columns are required but have no default, so they are added
-- nullable, backfilled for every existing claim, then tightened to NOT NULL.
-- Adding them as NOT NULL outright would fail on any populated table.

-- AlterTable
ALTER TABLE "OrganisationClaim" ADD COLUMN     "envelopeContentCount" INTEGER,
ADD COLUMN     "envelopeContentImageCount" INTEGER;

-- AlterTable
ALTER TABLE "SubscriptionClaim" ADD COLUMN     "envelopeContentCount" INTEGER,
ADD COLUMN     "envelopeContentImageCount" INTEGER;

-- Backfill every existing claim as unlimited (0).
UPDATE "OrganisationClaim" SET "envelopeContentCount" = 0, "envelopeContentImageCount" = 0;
UPDATE "SubscriptionClaim" SET "envelopeContentCount" = 0, "envelopeContentImageCount" = 0;

-- AlterTable
ALTER TABLE "OrganisationClaim" ALTER COLUMN "envelopeContentCount" SET NOT NULL,
ALTER COLUMN "envelopeContentImageCount" SET NOT NULL;

-- AlterTable
ALTER TABLE "SubscriptionClaim" ALTER COLUMN "envelopeContentCount" SET NOT NULL,
ALTER COLUMN "envelopeContentImageCount" SET NOT NULL;

-- CreateTable
CREATE TABLE "EnvelopeContent" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "envelopeItemId" TEXT NOT NULL,
    "contentMeta" JSONB NOT NULL,
    "dataContentId" TEXT,

    CONSTRAINT "EnvelopeContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataContent" (
    "id" TEXT NOT NULL,
    "type" "DocumentDataType" NOT NULL,
    "data" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "DataContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnvelopeContent_envelopeId_idx" ON "EnvelopeContent"("envelopeId");

-- CreateIndex
CREATE INDEX "EnvelopeContent_envelopeItemId_idx" ON "EnvelopeContent"("envelopeItemId");

-- AddForeignKey
ALTER TABLE "EnvelopeContent" ADD CONSTRAINT "EnvelopeContent_envelopeItemId_fkey" FOREIGN KEY ("envelopeItemId") REFERENCES "EnvelopeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvelopeContent" ADD CONSTRAINT "EnvelopeContent_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvelopeContent" ADD CONSTRAINT "EnvelopeContent_dataContentId_fkey" FOREIGN KEY ("dataContentId") REFERENCES "DataContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
