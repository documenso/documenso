-- AlterTable
-- Add the column with a temporary DEFAULT so Postgres backfills existing rows
-- to 'SES' (the only level the instance supported before this migration). The
-- DEFAULT is then dropped so future INSERTs must specify signatureLevel
-- explicitly via resolveSignatureLevel — the column carries no DB-level default
-- by design (see packages/lib/server-only/signature-level/resolve-signature-level.ts).
ALTER TABLE "Envelope" ADD COLUMN "signatureLevel" TEXT NOT NULL DEFAULT 'SES';
ALTER TABLE "Envelope" ALTER COLUMN "signatureLevel" DROP DEFAULT;

-- CreateTable
CREATE TABLE "CscCredential" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "certCache" BYTEA,
    "signatureAlgorithm" TEXT NOT NULL,
    "keyType" TEXT NOT NULL,
    "digestAlgorithm" TEXT NOT NULL,
    "keyLenBits" INTEGER,
    "signAlgoParams" TEXT,
    "serviceTokenCiphertext" BYTEA,
    "serviceTokenExpiresAt" TIMESTAMP(3),
    "recipientId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CscCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CscSession" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "signingTime" TIMESTAMP(3) NOT NULL,
    "itemsJson" JSONB NOT NULL,
    "encryptedSad" BYTEA,
    "sadExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientId" INTEGER NOT NULL,

    CONSTRAINT "CscSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CscCredential_recipientId_key" ON "CscCredential"("recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "CscSession_recipientId_key" ON "CscSession"("recipientId");

-- AddForeignKey
ALTER TABLE "CscCredential" ADD CONSTRAINT "CscCredential_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CscSession" ADD CONSTRAINT "CscSession_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
