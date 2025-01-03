/*
  Warnings:

  - You are about to drop the column `secondaryUserId` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryUserId` on the `ApiToken` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryUserId` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryUserId` on the `Passkey` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryUserId` on the `PasswordResetToken` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryUserId` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryUserId` on the `SiteSettings` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryUserId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryUserId` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryUserId` on the `TeamMember` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryUserId` on the `TeamPending` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryUserId` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryUserId` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryUserId` on the `UserSecurityAuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryUserId` on the `VerificationToken` table. All the data in the column will be lost.
  - You are about to drop the column `secondaryUserId` on the `Webhook` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "ApiToken" DROP CONSTRAINT "ApiToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_userId_fkey";

-- DropForeignKey
ALTER TABLE "Passkey" DROP CONSTRAINT "Passkey_userId_fkey";

-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "SiteSettings" DROP CONSTRAINT "SiteSettings_lastModifiedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";

-- DropForeignKey
ALTER TABLE "Team" DROP CONSTRAINT "Team_ownerUserId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMember" DROP CONSTRAINT "TeamMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "TeamPending" DROP CONSTRAINT "TeamPending_ownerUserId_fkey";

-- DropForeignKey
ALTER TABLE "Template" DROP CONSTRAINT "Template_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserProfile" DROP CONSTRAINT "UserProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserSecurityAuditLog" DROP CONSTRAINT "UserSecurityAuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "VerificationToken" DROP CONSTRAINT "VerificationToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "Webhook" DROP CONSTRAINT "Webhook_userId_fkey";

-- AlterTable
ALTER TABLE "Account" RENAME COLUMN "userId" TO "userId_old";
ALTER TABLE "Account" RENAME COLUMN "secondaryUserId" TO "userId";
ALTER TABLE "Account" DROP COLUMN "userId_old";

-- AlterTable
ALTER TABLE "ApiToken" RENAME COLUMN "userId" TO "userId_old";
ALTER TABLE "ApiToken" RENAME COLUMN "secondaryUserId" TO "userId";
ALTER TABLE "ApiToken" DROP COLUMN "userId_old";

-- AlterTable
ALTER TABLE "Document" RENAME COLUMN "userId" TO "userId_old";
ALTER TABLE "Document" RENAME COLUMN "secondaryUserId" TO "userId";
ALTER TABLE "Document" DROP COLUMN "userId_old";

-- AlterTable
ALTER TABLE "Passkey" RENAME COLUMN "userId" TO "userId_old";
ALTER TABLE "Passkey" RENAME COLUMN "secondaryUserId" TO "userId";
ALTER TABLE "Passkey" DROP COLUMN "userId_old";

-- AlterTable
ALTER TABLE "PasswordResetToken" RENAME COLUMN "userId" TO "userId_old";
ALTER TABLE "PasswordResetToken" RENAME COLUMN "secondaryUserId" TO "userId";
ALTER TABLE "PasswordResetToken" DROP COLUMN "userId_old";

-- AlterTable
ALTER TABLE "Session" RENAME COLUMN "userId" TO "userId_old";
ALTER TABLE "Session" RENAME COLUMN "secondaryUserId" TO "userId";
ALTER TABLE "Session" DROP COLUMN "userId_old";

-- AlterTable
ALTER TABLE "SiteSettings" RENAME COLUMN "lastModifiedByUserId" TO "lastModifiedByUserId_old";
ALTER TABLE "SiteSettings" RENAME COLUMN "secondaryUserId" TO "lastModifiedByUserId";
ALTER TABLE "SiteSettings" DROP COLUMN "lastModifiedByUserId_old";

-- AlterTable
ALTER TABLE "Subscription" RENAME COLUMN "userId" TO "userId_old";
ALTER TABLE "Subscription" RENAME COLUMN "secondaryUserId" TO "userId";
ALTER TABLE "Subscription" DROP COLUMN "userId_old";

-- AlterTable
ALTER TABLE "Team" RENAME COLUMN "ownerUserId" TO "ownerUserId_old";
ALTER TABLE "Team" RENAME COLUMN "secondaryUserId" TO "ownerUserId";
ALTER TABLE "Team" DROP COLUMN "ownerUserId_old";

-- AlterTable
ALTER TABLE "TeamMember" RENAME COLUMN "userId" TO "userId_old";
ALTER TABLE "TeamMember" RENAME COLUMN "secondaryUserId" TO "userId";
ALTER TABLE "TeamMember" DROP COLUMN "userId_old";

-- AlterTable
ALTER TABLE "TeamPending" RENAME COLUMN "ownerUserId" TO "ownerUserId_old";
ALTER TABLE "TeamPending" RENAME COLUMN "secondaryUserId" TO "ownerUserId";
ALTER TABLE "TeamPending" DROP COLUMN "ownerUserId_old";

-- AlterTable
ALTER TABLE "Template" RENAME COLUMN "userId" TO "userId_old";
ALTER TABLE "Template" RENAME COLUMN "secondaryUserId" TO "userId";
ALTER TABLE "Template" DROP COLUMN "userId_old";

-- AlterTable
ALTER TABLE "UserProfile" RENAME COLUMN "userId" TO "userId_old";
ALTER TABLE "UserProfile" RENAME COLUMN "secondaryUserId" TO "userId";
ALTER TABLE "UserProfile" DROP COLUMN "userId_old";

-- AlterTable
ALTER TABLE "UserSecurityAuditLog" RENAME COLUMN "userId" TO "userId_old";
ALTER TABLE "UserSecurityAuditLog" RENAME COLUMN "secondaryUserId" TO "userId";
ALTER TABLE "UserSecurityAuditLog" DROP COLUMN "userId_old";

-- AlterTable
ALTER TABLE "VerificationToken" RENAME COLUMN "userId" TO "userId_old";
ALTER TABLE "VerificationToken" RENAME COLUMN "secondaryUserId" TO "userId";
ALTER TABLE "VerificationToken" DROP COLUMN "userId_old";

-- AlterTable
ALTER TABLE "Webhook" RENAME COLUMN "userId" TO "userId_old";
ALTER TABLE "Webhook" RENAME COLUMN "secondaryUserId" TO "userId";
ALTER TABLE "Webhook" DROP COLUMN "userId_old";

-- AlterTable
ALTER TABLE "TeamTransferVerification" ALTER COLUMN "userId" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("secondaryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSecurityAuditLog" ADD CONSTRAINT "UserSecurityAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("secondaryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("secondaryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("secondaryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("secondaryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("secondaryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("secondaryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("secondaryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("secondaryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("secondaryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("secondaryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("secondaryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPending" ADD CONSTRAINT "TeamPending_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("secondaryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("secondaryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("secondaryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_lastModifiedByUserId_fkey" FOREIGN KEY ("lastModifiedByUserId") REFERENCES "User"("secondaryId") ON DELETE SET NULL ON UPDATE CASCADE;
