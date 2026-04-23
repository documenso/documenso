-- CreateTable
CREATE TABLE "Redaction" (
    "id" SERIAL NOT NULL,
    "secondaryId" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "envelopeItemId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "positionX" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "positionY" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "width" DECIMAL(65,30) NOT NULL DEFAULT -1,
    "height" DECIMAL(65,30) NOT NULL DEFAULT -1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Redaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Redaction_secondaryId_key" ON "Redaction"("secondaryId");

-- CreateIndex
CREATE INDEX "Redaction_envelopeId_idx" ON "Redaction"("envelopeId");

-- CreateIndex
CREATE INDEX "Redaction_envelopeItemId_idx" ON "Redaction"("envelopeItemId");

-- AddForeignKey
ALTER TABLE "Redaction" ADD CONSTRAINT "Redaction_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redaction" ADD CONSTRAINT "Redaction_envelopeItemId_fkey" FOREIGN KEY ("envelopeItemId") REFERENCES "EnvelopeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
