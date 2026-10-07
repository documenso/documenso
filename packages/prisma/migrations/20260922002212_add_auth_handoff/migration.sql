-- CreateTable
CREATE TABLE "AuthHandoff" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthHandoff_expiresAt_idx" ON "AuthHandoff"("expiresAt");

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "isEmbed" BOOLEAN NOT NULL DEFAULT false;
