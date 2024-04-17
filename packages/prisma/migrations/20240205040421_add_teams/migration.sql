/*
  Warnings:

  - A unique constraint covering the columns `[teamId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TeamMemberRole" AS ENUM ('ADMIN', 'MANAGER', 'MEMBER');

-- CreateEnum
CREATE TYPE "TeamMemberInviteStatus" AS ENUM ('ACCEPTED', 'PENDING');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "teamId" INTEGER;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "teamId" INTEGER,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT,
    "ownerUserId" INTEGER NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamPending" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT NOT NULL,
    "ownerUserId" INTEGER NOT NULL,

    CONSTRAINT "TeamPending_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "TeamMemberRole" NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamEmail" (
    "teamId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "TeamEmail_pkey" PRIMARY KEY ("teamId")
);

-- CreateTable
CREATE TABLE "TeamEmailVerification" (
    "teamId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamEmailVerification_pkey" PRIMARY KEY ("teamId")
);

-- CreateTable
CREATE TABLE "TeamTransferVerification" (
    "teamId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clearPaymentMethods" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TeamTransferVerification_pkey" PRIMARY KEY ("teamId")
);

-- CreateTable
CREATE TABLE "TeamMemberInvite" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "status" "TeamMemberInviteStatus" NOT NULL DEFAULT 'PENDING',
    "role" "TeamMemberRole" NOT NULL,
    "token" TEXT NOT NULL,

    CONSTRAINT "TeamMemberInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_url_key" ON "Team"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Team_customerId_key" ON "Team"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamPending_url_key" ON "TeamPending"("url");

-- CreateIndex
CREATE UNIQUE INDEX "TeamPending_customerId_key" ON "TeamPending"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_userId_teamId_key" ON "TeamMember"("userId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamEmail_teamId_key" ON "TeamEmail"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamEmail_email_key" ON "TeamEmail"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TeamEmailVerification_teamId_key" ON "TeamEmailVerification"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamEmailVerification_token_key" ON "TeamEmailVerification"("token");

-- CreateIndex
CREATE UNIQUE INDEX "TeamTransferVerification_teamId_key" ON "TeamTransferVerification"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamTransferVerification_token_key" ON "TeamTransferVerification"("token");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMemberInvite_token_key" ON "TeamMemberInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMemberInvite_teamId_email_key" ON "TeamMemberInvite"("teamId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_teamId_key" ON "Subscription"("teamId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPending" ADD CONSTRAINT "TeamPending_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamEmail" ADD CONSTRAINT "TeamEmail_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamEmailVerification" ADD CONSTRAINT "TeamEmailVerification_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamTransferVerification" ADD CONSTRAINT "TeamTransferVerification_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMemberInvite" ADD CONSTRAINT "TeamMemberInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Subscription"
ADD CONSTRAINT teamId_or_userId_check
CHECK (
  (
    "teamId" IS NOT NULL
    AND "userId" IS NULL
  )
  OR (
    "teamId" IS NULL
    AND "userId" IS NOT NULL
  )
);
