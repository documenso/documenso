-- CreateEnum
CREATE TYPE "SigningTwoFactorTokenStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "SigningTwoFactorToken" (
    "id" TEXT NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenSalt" TEXT NOT NULL,
    "status" "SigningTwoFactorTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "attemptLimit" INTEGER NOT NULL DEFAULT 5,
    "issuedByApiTokenId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigningTwoFactorToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigningSessionTwoFactorProof" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SigningSessionTwoFactorProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SigningTwoFactorToken_recipientId_envelopeId_status_idx" ON "SigningTwoFactorToken"("recipientId", "envelopeId", "status");

-- CreateIndex
CREATE INDEX "SigningTwoFactorToken_envelopeId_idx" ON "SigningTwoFactorToken"("envelopeId");

-- CreateIndex
CREATE INDEX "SigningSessionTwoFactorProof_recipientId_envelopeId_idx" ON "SigningSessionTwoFactorProof"("recipientId", "envelopeId");

-- CreateIndex
CREATE INDEX "SigningSessionTwoFactorProof_expiresAt_idx" ON "SigningSessionTwoFactorProof"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SigningSessionTwoFactorProof_sessionId_recipientId_envelope_key" ON "SigningSessionTwoFactorProof"("sessionId", "recipientId", "envelopeId");

-- AddForeignKey
ALTER TABLE "SigningTwoFactorToken" ADD CONSTRAINT "SigningTwoFactorToken_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningTwoFactorToken" ADD CONSTRAINT "SigningTwoFactorToken_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningSessionTwoFactorProof" ADD CONSTRAINT "SigningSessionTwoFactorProof_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningSessionTwoFactorProof" ADD CONSTRAINT "SigningSessionTwoFactorProof_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;
