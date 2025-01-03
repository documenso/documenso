/*
  Warnings:

  - A unique constraint covering the columns `[userId,teamId]` on the table `TeamMember` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `UserProfile` will be added. If there are existing duplicate values, this will fail.
  - Made the column `userId` on table `Account` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `Document` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `PasswordResetToken` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `Session` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ownerUserId` on table `Team` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `TeamMember` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ownerUserId` on table `TeamPending` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `Template` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `UserProfile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `UserSecurityAuditLog` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `VerificationToken` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `Webhook` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PasswordResetToken" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Team" ALTER COLUMN "ownerUserId" SET NOT NULL;

-- AlterTable
ALTER TABLE "TeamMember" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "TeamPending" ALTER COLUMN "ownerUserId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Template" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "UserProfile" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "UserSecurityAuditLog" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "VerificationToken" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Webhook" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_userId_teamId_key" ON "TeamMember"("userId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");
