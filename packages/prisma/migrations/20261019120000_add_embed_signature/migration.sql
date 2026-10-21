-- CreateTable
CREATE TABLE "EmbedSignature" (
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organisationId" TEXT NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "signature" TEXT NOT NULL,

    CONSTRAINT "EmbedSignature_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "EmbedSignature_organisationId_idx" ON "EmbedSignature"("organisationId");

-- CreateIndex
CREATE INDEX "EmbedSignature_recipientId_idx" ON "EmbedSignature"("recipientId");

-- AddForeignKey
ALTER TABLE "EmbedSignature" ADD CONSTRAINT "EmbedSignature_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
