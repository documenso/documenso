-- CreateEnum
CREATE TYPE "TagType" AS ENUM ('DOCUMENT', 'TEMPLATE');

-- CreateTable
CREATE TABLE "Tag" (
    "id"        TEXT   NOT NULL,
    "name"      TEXT   NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "type"      "TagType" NOT NULL,
    "teamId"    INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvelopeTag" (
    "envelopeId" TEXT NOT NULL,
    "tagId"      TEXT NOT NULL,
    "assignedBy" INTEGER,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvelopeTag_pkey" PRIMARY KEY ("envelopeId", "tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_teamId_normalizedName_type_key" ON "Tag"("teamId", "normalizedName", "type");

-- CreateIndex
CREATE INDEX "Tag_teamId_idx" ON "Tag"("teamId");

-- CreateIndex
CREATE INDEX "Tag_teamId_type_idx" ON "Tag"("teamId", "type");

-- CreateIndex
CREATE INDEX "EnvelopeTag_tagId_idx" ON "EnvelopeTag"("tagId");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvelopeTag" ADD CONSTRAINT "EnvelopeTag_envelopeId_fkey"
    FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvelopeTag" ADD CONSTRAINT "EnvelopeTag_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvelopeTag" ADD CONSTRAINT "EnvelopeTag_assignedBy_fkey"
    FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL;