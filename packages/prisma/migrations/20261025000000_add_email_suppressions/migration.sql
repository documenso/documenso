-- CreateEnum
CREATE TYPE "EmailSuppressionScope" AS ENUM ('GLOBAL', 'ORGANISATION', 'TEAM', 'USER');

-- CreateEnum
CREATE TYPE "EmailSuppressionSource" AS ENUM ('RECIPIENT', 'ADMIN');

-- CreateTable
CREATE TABLE "EmailSuppression" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "scope" "EmailSuppressionScope" NOT NULL,
    "source" "EmailSuppressionSource" NOT NULL,
    "reason" TEXT,
    "organisationId" TEXT,
    "teamId" INTEGER,
    "userId" INTEGER,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailSuppression_email_idx" ON "EmailSuppression"("email");

-- CreateIndex
CREATE INDEX "EmailSuppression_organisationId_idx" ON "EmailSuppression"("organisationId");

-- CreateIndex
CREATE INDEX "EmailSuppression_teamId_idx" ON "EmailSuppression"("teamId");

-- CreateIndex
CREATE INDEX "EmailSuppression_userId_idx" ON "EmailSuppression"("userId");

-- AddForeignKey
ALTER TABLE "EmailSuppression" ADD CONSTRAINT "EmailSuppression_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSuppression" ADD CONSTRAINT "EmailSuppression_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSuppression" ADD CONSTRAINT "EmailSuppression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

