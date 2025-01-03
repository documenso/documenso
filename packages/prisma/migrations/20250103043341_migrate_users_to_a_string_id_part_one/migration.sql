-- !: This needs to run first

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "secondaryId" TEXT;

-- Set all null secondaryId users to a uuid
UPDATE "User" SET "secondaryId" = gen_random_uuid()::text WHERE "secondaryId" IS NULL;

-- Restrict the secondaryId to required
ALTER TABLE "User" ALTER COLUMN "secondaryId" SET NOT NULL;

-- Now lets update all the tables that reference the user table to use the secondaryId
-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "secondaryUserId" TEXT;

UPDATE "Account" a SET "secondaryUserId" = (SELECT "secondaryId" FROM "User" u WHERE u."id" = a."userId");

-- AlterTable
ALTER TABLE "ApiToken" ADD COLUMN     "secondaryUserId" TEXT;

UPDATE "ApiToken" a SET "secondaryUserId" = (SELECT "secondaryId" FROM "User" u WHERE u."id" = a."userId");

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "secondaryUserId" TEXT;

UPDATE "Document" d SET "secondaryUserId" = (SELECT "secondaryId" FROM "User" u WHERE u."id" = d."userId");

-- AlterTable
ALTER TABLE "Passkey" ADD COLUMN     "secondaryUserId" TEXT NOT NULL;

UPDATE "Passkey" p SET "secondaryUserId" = (SELECT "secondaryId" FROM "User" u WHERE u."id" = p."userId");

-- AlterTable
ALTER TABLE "PasswordResetToken" ADD COLUMN     "secondaryUserId" TEXT;

UPDATE "PasswordResetToken" p SET "secondaryUserId" = (SELECT "secondaryId" FROM "User" u WHERE u."id" = p."userId");

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "secondaryUserId" TEXT;

UPDATE "Session" s SET "secondaryUserId" = (SELECT "secondaryId" FROM "User" u WHERE u."id" = s."userId");

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "secondaryUserId" TEXT;

UPDATE "SiteSettings" s SET "secondaryUserId" = (SELECT "secondaryId" FROM "User" u WHERE u."id" = s."lastModifiedByUserId");

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "secondaryUserId" TEXT;

UPDATE "Subscription" s SET "secondaryUserId" = (SELECT "secondaryId" FROM "User" u WHERE u."id" = s."userId");

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "secondaryUserId" TEXT;

UPDATE "Team" t SET "secondaryUserId" = (SELECT "secondaryId" FROM "User" u WHERE u."id" = t."ownerUserId");

-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN     "secondaryUserId" TEXT;

UPDATE "TeamMember" tm SET "secondaryUserId" = (SELECT "secondaryId" FROM "User" u WHERE u."id" = tm."userId");

-- AlterTable
ALTER TABLE "TeamPending" ADD COLUMN     "secondaryUserId" TEXT;

UPDATE "TeamPending" tp SET "secondaryUserId" = (SELECT "secondaryId" FROM "User" u WHERE u."id" = tp."ownerUserId");

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "secondaryUserId" TEXT;

UPDATE "Template" t SET "secondaryUserId" = (SELECT "secondaryId" FROM "User" u WHERE u."id" = t."userId");

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "secondaryUserId" TEXT;

UPDATE "UserProfile" up SET "secondaryUserId" = (SELECT "secondaryId" FROM "User" u WHERE u."id" = up."userId");

-- AlterTable
ALTER TABLE "UserSecurityAuditLog" ADD COLUMN     "secondaryUserId" TEXT;

UPDATE "UserSecurityAuditLog" usal SET "secondaryUserId" = (SELECT "secondaryId" FROM "User" u WHERE u."id" = usal."userId");

-- AlterTable
ALTER TABLE "VerificationToken" ADD COLUMN     "secondaryUserId" TEXT;

UPDATE "VerificationToken" vt SET "secondaryUserId" = (SELECT "secondaryId" FROM "User" u WHERE u."id" = vt."userId");

-- AlterTable
ALTER TABLE "Webhook" ADD COLUMN     "secondaryUserId" TEXT;

UPDATE "Webhook" w SET "secondaryUserId" = (SELECT "secondaryId" FROM "User" u WHERE u."id" = w."userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_secondaryId_key" ON "User"("secondaryId");
