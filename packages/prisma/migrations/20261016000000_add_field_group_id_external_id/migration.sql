-- AlterTable
ALTER TABLE "Field" ADD COLUMN "externalId" VARCHAR(255),
ADD COLUMN "groupId" VARCHAR(255);

-- CreateIndex
CREATE INDEX "Field_envelopeId_groupId_idx" ON "Field"("envelopeId", "groupId");
