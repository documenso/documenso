-- CreateTable
CREATE TABLE "EnvelopeContent" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "envelopeItemId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "dataContentId" TEXT
);

-- CreateTable
CREATE TABLE "DataContent" (
    "id" TEXT NOT NULL,
    "type" "DocumentDataType" NOT NULL,
    "data" TEXT NOT NULL,

    CONSTRAINT "DataContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnvelopeContent_id_key" ON "EnvelopeContent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "EnvelopeContent_dataContentId_key" ON "EnvelopeContent"("dataContentId");

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
