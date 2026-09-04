-- CreateEnum
CREATE TYPE "SignupInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "SignupInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "SignupInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "SignupInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignupInvite_token_key" ON "SignupInvite"("token");

-- CreateIndex
CREATE INDEX "SignupInvite_email_status_idx" ON "SignupInvite"("email", "status");

-- CreateIndex
CREATE INDEX "SignupInvite_expiresAt_idx" ON "SignupInvite"("expiresAt");
