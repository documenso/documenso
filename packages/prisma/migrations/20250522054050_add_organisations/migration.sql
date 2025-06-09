/*
 * Organisation migration
 *
 * High level summary:
 * 1. Create a personal organisation for all users and move their personal entities (documents/templates/etc) into it
 * 2. Create an organisation for each user subscription, group teams with no subscriptions into these organisations
 * 3. Create an organisation for all teams with subscriptions
 *
 * Search "CUSTOM_CHANGE" to find areas where custom changes to the migration have occurred.
 *
 * POST MIGRATION REQUIREMENTS:
 * - Move individual subscriptions into personal organisations and delete the original organisation
 * - Set claims for all organisations
 * - Todo: orgs check for anything else.
 */

/*
 * Clean up subscriptions prior to full migration:
 * - Ensure each user has a maximum of 1 subscription tied to the "User" table
 * - Move the customerId from the teams/users into the subscription itself
 */
-- [CUSTOM_CHANGE_START]
WITH subscriptions_to_delete AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY
        (status = 'ACTIVE') DESC,  -- Prioritize active subscriptions
        "updatedAt" DESC          -- Then by most recently updated
    ) AS rn
  FROM "Subscription" s
  WHERE s."userId" IS NOT NULL
),
to_delete AS (
  SELECT id
  FROM subscriptions_to_delete
  WHERE rn > 1
)
DELETE FROM "Subscription"
WHERE id IN (SELECT id FROM to_delete);

-- Add customerId to Subscription
ALTER TABLE "Subscription" ADD COLUMN "customerId" TEXT;

-- Move customerId from User to Subscription
UPDATE "Subscription" s
SET "customerId" = u."customerId"
FROM "User" u
WHERE s."userId" = u."id";

-- Move customerId from Team to Subscription
UPDATE "Subscription" s
SET "customerId" = t."customerId"
FROM "Team" t
WHERE s."teamId" = t."id";

-- Remove any subscriptions with missing customerId
DELETE FROM "Subscription"
WHERE "customerId" IS NULL;

-- Make customerId not null
ALTER TABLE "Subscription" ALTER COLUMN "customerId" SET NOT NULL;

-- [CUSTOM_CHANGE_END]

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_teamId_fkey";
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";

-- DropIndex
DROP INDEX "Subscription_teamId_key";
DROP INDEX "Subscription_userId_idx";

-- DropConstraints
ALTER TABLE "Subscription" DROP CONSTRAINT "teamid_or_userid_check";

/*
 * Before starting the real migration, we want to do the following:
 * - Give every user a team with their personal entities (documents, templates, webhooks, profile, apiTokens)
 * - The team is temporary and tagged with a "isPersonal" boolean
*/
-- [CUSTOM_CHANGE_START]

-- 1. Ensure all users have a URL by setting a default CUID
UPDATE "User"
SET "url" = generate_id()
WHERE "url" IS NULL;

-- 2. Make User URL required
ALTER TABLE "User" ALTER COLUMN "url" SET NOT NULL;

-- 3. Add temp isPersonal boolean to Team table with default false
ALTER TABLE "Team" ADD COLUMN "isPersonal" BOOLEAN NOT NULL DEFAULT false;

-- 4. Create a personal team for every user
INSERT INTO "Team" ("name", "url", "createdAt", "ownerUserId", "avatarImageId", "isPersonal")
SELECT
'Personal Team',
"url", -- Use the user's URL directly
NOW(),
"id",
"avatarImageId",
true -- Set isPersonal to true for these personal teams
FROM "User" u;

-- 5. Add each user as an ADMIN member of their own team
INSERT INTO "TeamMember" ("teamId", "userId", "role", "createdAt")
SELECT t."id", u."id", 'ADMIN', NOW()
FROM "User" u
JOIN "Team" t ON t."ownerUserId" = u."id"
WHERE t."isPersonal" = true;

-- 6. Migrate user's documents to their personal team
UPDATE "Document"
SET
"teamId" = t."id"
FROM "Team" t, "TeamMember" tm
WHERE tm."teamId" = t."id"
AND tm."userId" = "Document"."userId"
AND "Document"."userId" = t."ownerUserId"
AND "Document"."teamId" IS NULL
AND t."isPersonal" = true;

-- 7. Migrate user's templates to their team
UPDATE "Template"
SET
"teamId" = t."id"
FROM "Team" t, "TeamMember" tm
WHERE tm."teamId" = t."id"
AND tm."userId" = "Template"."userId"
AND "Template"."userId" = t."ownerUserId"
AND "Template"."teamId" IS NULL
AND t."isPersonal" = true;

-- 8. Migrate user's folders to their team
UPDATE "Folder" f
SET "teamId" = t."id"
FROM "Team" t
WHERE f."userId" = t."ownerUserId" AND f."teamId" IS NULL AND t."isPersonal" = true;

-- 9. Migrate user's webhooks to their team
UPDATE "Webhook" w
SET "teamId" = t."id"
FROM "Team" t
WHERE w."userId" = t."ownerUserId" AND w."teamId" IS NULL AND t."isPersonal" = true;

-- 10. Migrate user's API tokens to their team
UPDATE "ApiToken" apiToken
SET "teamId" = t."id"
FROM "Team" t
WHERE apiToken."userId" = t."ownerUserId" AND apiToken."teamId" IS NULL AND t."isPersonal" = true;

-- 11. Migrate user's team profiles to their team
INSERT INTO "TeamProfile" ("id", "enabled", "bio", "teamId")
SELECT
  gen_random_uuid(),
  up."enabled",
  up."bio",
  t."id" AS teamId
FROM "UserProfile" up
JOIN "User" u ON u."id" = up."userId"
JOIN "Team" t ON t."ownerUserId" = u."id" AND t."isPersonal" = TRUE;

-- [CUSTOM_CHANGE_END]

-- CreateEnum
CREATE TYPE "OrganisationGroupType" AS ENUM ('INTERNAL_ORGANISATION', 'INTERNAL_TEAM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "OrganisationMemberRole" AS ENUM ('ADMIN', 'MANAGER', 'MEMBER');

-- CreateEnum
CREATE TYPE "OrganisationMemberInviteStatus" AS ENUM ('ACCEPTED', 'PENDING', 'DECLINED');

-- CreateEnum
CREATE TYPE "OrganisationType" AS ENUM ('PERSONAL', 'ORGANISATION');

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_teamId_fkey";

-- DropForeignKey
ALTER TABLE "Team" DROP CONSTRAINT "Team_ownerUserId_fkey";

-- DropForeignKey
ALTER TABLE "TeamGlobalSettings" DROP CONSTRAINT "TeamGlobalSettings_teamId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMemberInvite" DROP CONSTRAINT "TeamMemberInvite_teamId_fkey";

-- DropForeignKey
ALTER TABLE "TeamPending" DROP CONSTRAINT "TeamPending_ownerUserId_fkey";

-- DropForeignKey
ALTER TABLE "TeamTransferVerification" DROP CONSTRAINT "TeamTransferVerification_teamId_fkey";

-- DropForeignKey
ALTER TABLE "UserProfile" DROP CONSTRAINT "UserProfile_userId_fkey";

-- DropIndex
DROP INDEX "Team_customerId_key";

-- DropIndex
DROP INDEX "TeamGlobalSettings_teamId_key";

-- DropIndex
DROP INDEX "User_customerId_key";

-- DropIndex
DROP INDEX "User_url_key";

-- DropTable
DROP TABLE "UserProfile";

-- AlterTable
ALTER TABLE "Folder" ALTER COLUMN "teamId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Webhook" ALTER COLUMN "teamId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ApiToken" ALTER COLUMN "teamId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "teamId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "organisationId" TEXT; -- [CUSTOM_CHANGE] This is supposed to be NOT NULL (we reapply it at the end)

-- AlterTable
ALTER TABLE "Team" DROP COLUMN "customerId",
ADD COLUMN     "organisationId" TEXT, -- [CUSTOM_CHANGE] This is supposed to be NOT NULL (we reapply it at the end)
ADD COLUMN     "teamGlobalSettingsId" TEXT; -- [CUSTOM_CHANGE] This is supposed to be NOT NULL (we reapply it at the end)

-- AlterTable
ALTER TABLE "TeamGlobalSettings" DROP COLUMN "allowEmbeddedAuthoring",
DROP COLUMN "brandingHidePoweredBy",
ADD COLUMN     "id" TEXT, -- [CUSTOM_CHANGE] Supposed to be NOT NULL but we apply it after generating default IDs
ALTER COLUMN "documentVisibility" DROP NOT NULL,
ALTER COLUMN "documentVisibility" DROP DEFAULT,
ALTER COLUMN "includeSenderDetails" DROP NOT NULL,
ALTER COLUMN "includeSenderDetails" DROP DEFAULT,
ALTER COLUMN "brandingCompanyDetails" DROP NOT NULL,
ALTER COLUMN "brandingCompanyDetails" DROP DEFAULT,
ALTER COLUMN "brandingEnabled" DROP NOT NULL,
ALTER COLUMN "brandingEnabled" DROP DEFAULT,
ALTER COLUMN "brandingLogo" DROP NOT NULL,
ALTER COLUMN "brandingLogo" DROP DEFAULT,
ALTER COLUMN "brandingUrl" DROP NOT NULL,
ALTER COLUMN "brandingUrl" DROP DEFAULT,
ALTER COLUMN "documentLanguage" DROP NOT NULL,
ALTER COLUMN "documentLanguage" DROP DEFAULT,
ALTER COLUMN "typedSignatureEnabled" DROP NOT NULL,
ALTER COLUMN "typedSignatureEnabled" DROP DEFAULT,
ALTER COLUMN "includeSigningCertificate" DROP NOT NULL,
ALTER COLUMN "includeSigningCertificate" DROP DEFAULT,
ALTER COLUMN "drawSignatureEnabled" DROP NOT NULL,
ALTER COLUMN "drawSignatureEnabled" DROP DEFAULT,
ALTER COLUMN "uploadSignatureEnabled" DROP NOT NULL,
ALTER COLUMN "uploadSignatureEnabled" DROP DEFAULT;

-- [CUSTOM_CHANGE] Generate IDs for existing TeamGlobalSettings records. We link it later.
UPDATE "TeamGlobalSettings" SET "id" = generate_prefix_id('team_setting') WHERE "id" IS NULL;

-- [CUSTOM_CHANGE] Make the id column NOT NULL and add primary key
ALTER TABLE "TeamGlobalSettings"
ALTER COLUMN "id" SET NOT NULL,
ADD CONSTRAINT "TeamGlobalSettings_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Template" ALTER COLUMN "teamId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "customerId";

-- DropTable
DROP TABLE "TeamMemberInvite";

-- DropTable
DROP TABLE "TeamPending";

-- DropTable
DROP TABLE "TeamTransferVerification";

-- DropEnum
DROP TYPE "TeamMemberInviteStatus";

-- CreateTable
CREATE TABLE "SubscriptionClaim" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "teamCount" INTEGER NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "flags" JSONB NOT NULL,

    CONSTRAINT "SubscriptionClaim_pkey" PRIMARY KEY ("id")
);

-- Todo: orgs validate prior to release
-- [CUSTOM_CHANGE] Insert default subscription claims
INSERT INTO "SubscriptionClaim" ("id", "name", "locked", "teamCount", "memberCount", "flags", "createdAt", "updatedAt")
VALUES
  ('free', 'Free', true, 1, 1, '{}'::jsonb, NOW(), NOW()),
  ('individual', 'Individual', true, 1, 1, '{"unlimitedDocuments": true}'::jsonb, NOW(), NOW()),
  ('team', 'Teams', true, 1, 5, '{"unlimitedDocuments": true, "allowCustomBranding": true, "embedSigning": true}'::jsonb, NOW(), NOW()),
  ('platform', 'Platform', true, 1, 0, '{"unlimitedDocuments": true, "allowCustomBranding": true, "hidePoweredBy": true, "embedAuthoring": false, "embedAuthoringWhiteLabel": true, "embedSigning": false, "embedSigningWhiteLabel": true}'::jsonb, NOW(), NOW()),
  ('enterprise', 'Enterprise', true, 0, 0, '{"unlimitedDocuments": true, "allowCustomBranding": true, "hidePoweredBy": true, "embedAuthoring": true, "embedAuthoringWhiteLabel": true, "embedSigning": true, "embedSigningWhiteLabel": true, "cfr21": true}'::jsonb, NOW(), NOW()),
  ('earlyAdopter', 'Early Adopter', true, 0, 0, '{"unlimitedDocuments": true, "allowCustomBranding": true, "hidePoweredBy": true, "embedSigning": true, "embedSigningWhiteLabel": true}'::jsonb, NOW(), NOW());

-- CreateTable
CREATE TABLE "OrganisationClaim" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "originalSubscriptionClaimId" TEXT,
    "teamCount" INTEGER NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "flags" JSONB NOT NULL,

    CONSTRAINT "OrganisationClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "OrganisationType" NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "avatarImageId" TEXT,
    "customerId" TEXT,
    "ownerUserId" INTEGER NOT NULL,
    "organisationClaimId" TEXT, -- [CUSTOM_CHANGE] Is supposed to be NOT NULL (we reapply it at the end)
    "organisationGlobalSettingsId" TEXT, -- [CUSTOM_CHANGE] Is supposed to be NOT NULL (we reapply it at the end)
    "teamId" INTEGER, -- [CUSTOM_CHANGE] This is a temporary column for migration purposes.

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationMember" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,
    "organisationId" TEXT NOT NULL,

    CONSTRAINT "OrganisationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationMemberInvite" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "OrganisationMemberInviteStatus" NOT NULL DEFAULT 'PENDING',
    "organisationId" TEXT NOT NULL,
    "organisationRole" "OrganisationMemberRole" NOT NULL,

    CONSTRAINT "OrganisationMemberInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "type" "OrganisationGroupType" NOT NULL,
    "organisationRole" "OrganisationMemberRole" NOT NULL,
    "organisationId" TEXT NOT NULL,

    CONSTRAINT "OrganisationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "organisationMemberId" TEXT NOT NULL,

    CONSTRAINT "OrganisationGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamGroup" (
    "id" TEXT NOT NULL,
    "organisationGroupId" TEXT NOT NULL,
    "teamRole" "TeamMemberRole" NOT NULL,
    "teamId" INTEGER NOT NULL,

    CONSTRAINT "TeamGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationGlobalSettings" (
    "id" TEXT NOT NULL,
    "documentVisibility" "DocumentVisibility" NOT NULL DEFAULT 'EVERYONE',
    "documentLanguage" TEXT NOT NULL DEFAULT 'en',
    "includeSenderDetails" BOOLEAN NOT NULL DEFAULT true,
    "includeSigningCertificate" BOOLEAN NOT NULL DEFAULT true,
    "typedSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "uploadSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "drawSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "brandingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "brandingLogo" TEXT NOT NULL DEFAULT '',
    "brandingUrl" TEXT NOT NULL DEFAULT '',
    "brandingCompanyDetails" TEXT NOT NULL DEFAULT '',
    "organisationId" TEXT, -- [CUSTOM_CHANGE] This is a temporary column for migration purposes.

    CONSTRAINT "OrganisationGlobalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_url_key" ON "Organisation"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_customerId_key" ON "Organisation"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_organisationClaimId_key" ON "Organisation"("organisationClaimId");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_organisationGlobalSettingsId_key" ON "Organisation"("organisationGlobalSettingsId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationMember_userId_organisationId_key" ON "OrganisationMember"("userId", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationMemberInvite_token_key" ON "OrganisationMemberInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationGroupMember_organisationMemberId_groupId_key" ON "OrganisationGroupMember"("organisationMemberId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamGroup_teamId_organisationGroupId_key" ON "TeamGroup"("teamId", "organisationGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organisationId_key" ON "Subscription"("organisationId");

-- CreateIndex
CREATE INDEX "Subscription_organisationId_idx" ON "Subscription"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_teamGlobalSettingsId_key" ON "Team"("teamGlobalSettingsId");

-- CreateIndex
CREATE INDEX "Template_userId_idx" ON "Template"("userId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_organisationClaimId_fkey" FOREIGN KEY ("organisationClaimId") REFERENCES "OrganisationClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_avatarImageId_fkey" FOREIGN KEY ("avatarImageId") REFERENCES "AvatarImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_organisationGlobalSettingsId_fkey" FOREIGN KEY ("organisationGlobalSettingsId") REFERENCES "OrganisationGlobalSettings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationMember" ADD CONSTRAINT "OrganisationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationMember" ADD CONSTRAINT "OrganisationMember_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationMemberInvite" ADD CONSTRAINT "OrganisationMemberInvite_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationGroup" ADD CONSTRAINT "OrganisationGroup_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationGroupMember" ADD CONSTRAINT "OrganisationGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OrganisationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationGroupMember" ADD CONSTRAINT "OrganisationGroupMember_organisationMemberId_fkey" FOREIGN KEY ("organisationMemberId") REFERENCES "OrganisationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamGroup" ADD CONSTRAINT "TeamGroup_organisationGroupId_fkey" FOREIGN KEY ("organisationGroupId") REFERENCES "OrganisationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamGroup" ADD CONSTRAINT "TeamGroup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_teamGlobalSettingsId_fkey" FOREIGN KEY ("teamGlobalSettingsId") REFERENCES "TeamGlobalSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- [CUSTOM_CHANGE] FROM HERE ON IT'S ALL CUSTOM

/*
 * The current state of the migration is that:
 * - All users have a team with their personal entities excluding subscriptions
 * - All entities should be tied into teams
 *
 * Our goal is now to migrate organisations
 *
 * If subscription is attached to user account, that means it is either:
 * - Individual
 * - Platform
 * - Enterprise
 * - Early Adopter
 *
 * If subscription is attached to a team, that means it is:
 * - Team
 *
 * Note: We will handle moving Individual plans into personal organisations as a part of a
 * secondary migration script since we need the Stripe price IDs
 *
*/

/*
 * Handle creating free personal organisations
 *
 * Criteria for "personal team":
 * - Team is "isPersonal" is true
 */
WITH personal_organisations AS (
  INSERT INTO "Organisation" (
    "id", "createdAt", "updatedAt", "type", "name", "url", "avatarImageId", "ownerUserId", "teamId", "customerId"
  )
  SELECT
    generate_prefix_id('org'),
    t."createdAt",
    NOW(),
    'PERSONAL'::"OrganisationType",
    'Personal Organisation',
    u."url",
    t."avatarImageId",
    t."ownerUserId",
    t."id",
    s."customerId"
  FROM "Team" t
  JOIN "User" u ON u."id" = t."ownerUserId"
  LEFT JOIN "Subscription" s ON s."teamId" = t."id"
  WHERE t."isPersonal"
  RETURNING "id", "ownerUserId", "teamId", "customerId"
)
UPDATE "Team" t
SET "organisationId" = o."id"
FROM personal_organisations o
WHERE o."teamId" = t."id";

/*
 * Handle creating organisations for teams with "teams plan" subscriptions
 *
 * Criteria for "teams plan" team:
 * - Team has a subscription
 */
WITH team_plan_organisations AS (
  INSERT INTO "Organisation" (
    "id", "createdAt", "updatedAt", "type", "name", "url", "avatarImageId", "ownerUserId", "teamId", "customerId"
  )
  SELECT
    generate_prefix_id('org'),
    t."createdAt",
    NOW(),
    'ORGANISATION'::"OrganisationType",
    t."name",
    generate_id(),
    t."avatarImageId",
    t."ownerUserId",
    t."id",
    s."customerId"
  FROM "Team" t
  LEFT JOIN "Subscription" s ON s."teamId" = t."id"
  WHERE s."teamId" IS NOT NULL
  RETURNING "id", "ownerUserId", "teamId", "customerId"
)
UPDATE "Team" t
SET "organisationId" = o."id"
FROM team_plan_organisations o
WHERE o."teamId" = t."id";

/*
 * Handle account level subscriptions
 *
 * Goal:
 * - Create a single organisation for each user subscription
 * - Move all non personal teams without subscriptions into the newly created organisation
 * - Move user subscription to the organisation
 *
 * Plan:
 * 1. Create organisation for every user who still has a subscription attached to the user
 * 2. Find all teams that are not yet linked to an organisation
 * 3. Link the team into the organisation of the owner which is NOT personal
 *
 */
WITH users_to_migrate AS (
  SELECT u."id" AS user_id, s."customerId" AS customer_id
  FROM "User" u
  JOIN "Subscription" s ON s."userId" = u."id"
),
new_orgs AS (
  INSERT INTO "Organisation" (
    "id", "createdAt", "updatedAt", "type", "name", "url", "ownerUserId", "customerId"
  )
  SELECT
    generate_prefix_id('org'),
    NOW(),
    NOW(),
    'ORGANISATION'::"OrganisationType",
    'Organisation Name',
    generate_id(),
    u.user_id,
    u.customer_id
  FROM users_to_migrate u
  RETURNING "id", "ownerUserId", "customerId"
),
update_teams AS (
  UPDATE "Team" t
  SET "organisationId" = o."id"
  FROM new_orgs o
  WHERE
    t."ownerUserId" = o."ownerUserId"
    AND t."organisationId" IS NULL
    AND t."isPersonal" = FALSE
)
UPDATE "Subscription" s
SET "organisationId" = o."id"
FROM new_orgs o
WHERE s."userId" = o."ownerUserId";

-- Create 3 internal groups for each organisation (ADMIN, MANAGER, MEMBER)
WITH org_groups AS (
  SELECT
    o.id as org_id,
    unnest(ARRAY[
      'ADMIN'::"OrganisationMemberRole",
      'MANAGER'::"OrganisationMemberRole",
      'MEMBER'::"OrganisationMemberRole"
    ]) as role
  FROM "Organisation" o
)
INSERT INTO "OrganisationGroup" ("id", "type", "organisationRole", "organisationId")
SELECT
  generate_prefix_id('org_group'),
  'INTERNAL_ORGANISATION'::"OrganisationGroupType",
  og.role,
  og.org_id
FROM org_groups og;

-- Create TeamGlobalSettings for all teams that do not have a teamGlobalSettingsId
INSERT INTO "TeamGlobalSettings" ("id", "teamId")
SELECT
  generate_prefix_id('team_setting'),
  t."id"
FROM "Team" t
WHERE t."teamGlobalSettingsId" IS NULL;

-- Update teams with their corresponding teamGlobalSettingsId
UPDATE "Team" t
SET "teamGlobalSettingsId" = tgs."id"
FROM "TeamGlobalSettings" tgs
WHERE tgs."teamId" = t."id" AND t."teamGlobalSettingsId" IS NULL;

-- Create default OrganisationGlobalSettings for all organisations
INSERT INTO "OrganisationGlobalSettings" ("id", "organisationId")
SELECT
  generate_prefix_id('org_setting'),
  o."id"
FROM "Organisation" o
WHERE o."organisationGlobalSettingsId" IS NULL;

-- Update organisations with their corresponding organisationGlobalSettingsId
UPDATE "Organisation" o
SET "organisationGlobalSettingsId" = ogs."id"
FROM "OrganisationGlobalSettings" ogs
WHERE ogs."organisationId" = o."id" AND o."organisationGlobalSettingsId" IS NULL;

-- Create TeamGlobalSettings for all teams missing it
WITH teams_to_update AS (
  SELECT "id" AS team_id, generate_prefix_id('team_setting') AS settings_id
  FROM "Team"
  WHERE "teamGlobalSettingsId" IS NULL
),
new_team_settings AS (
  INSERT INTO "TeamGlobalSettings" ("id")
  SELECT settings_id FROM teams_to_update
  RETURNING "id"
)
UPDATE "Team" t
SET "teamGlobalSettingsId" = ttu.settings_id
FROM teams_to_update ttu
WHERE t."id" = ttu.team_id;

-- Create OrganisationClaim for every organisation, use the default "FREE" claim
WITH orgs_to_update AS (
  SELECT "id" AS org_id, generate_prefix_id('org_claim') AS claim_id
  FROM "Organisation"
  WHERE "organisationClaimId" IS NULL
),
new_claims AS (
  INSERT INTO "OrganisationClaim" (
    "id",
    "createdAt",
    "updatedAt",
    "originalSubscriptionClaimId",
    "teamCount",
    "memberCount",
    "flags"
  )
  SELECT
    claim_id,
    now(),
    now(),
    'free',
    1,
    1,
    '{}'::jsonb
  FROM orgs_to_update
  RETURNING "id" AS claim_id
)
UPDATE "Organisation" o
SET "organisationClaimId" = otu.claim_id
FROM orgs_to_update otu
WHERE o."id" = otu.org_id;

-- Create 2 TeamGroups to assign the internal Organisation Admin/Manager groups to teams
WITH org_internal_groups AS (
  SELECT
    og.id as group_id,
    og."organisationId",
    og."organisationRole",
    t.id as team_id
  FROM "OrganisationGroup" og
  JOIN "Team" t ON t."organisationId" = og."organisationId"
  WHERE og.type = 'INTERNAL_ORGANISATION'
  AND og."organisationRole" IN ('ADMIN', 'MANAGER')
)
INSERT INTO "TeamGroup" ("id", "teamId", "organisationGroupId", "teamRole")
SELECT
  generate_prefix_id('team_group'),
  oig.team_id,
  oig.group_id,
  'ADMIN'::"TeamMemberRole" -- Org Admins/Managers will be Team ADMINS
FROM org_internal_groups oig;

-- Temp columns for the following procedure
ALTER TABLE "OrganisationGroup" ADD COLUMN temp_team_id INT;
ALTER TABLE "OrganisationGroup" ADD COLUMN temp_team_role TEXT;

WITH team_internal_groups AS (
  -- Step 1: Create all team+role combinations
  SELECT
      t.id as team_id,
      t."organisationId",
      unnest(ARRAY[
        'ADMIN'::"TeamMemberRole",
        'MANAGER'::"TeamMemberRole",
        'MEMBER'::"TeamMemberRole"
      ]) as team_role
  FROM "Team" t
),
created_org_groups AS (
  -- Step 2: Create OrganisationGroups with temp data
  INSERT INTO "OrganisationGroup" (
    "id",
    "type",
    "organisationRole",
    "organisationId",
    temp_team_id,
    temp_team_role
  )
  SELECT
    generate_prefix_id('org_group'),
    'INTERNAL_TEAM'::"OrganisationGroupType",
    'MEMBER'::"OrganisationMemberRole",
    tig."organisationId",
    tig.team_id,
    tig.team_role::TEXT
  FROM team_internal_groups tig
  RETURNING "id", temp_team_id, temp_team_role
)
-- Step 3: Create TeamGroups using the temp data
INSERT INTO "TeamGroup" ("id", "organisationGroupId", "teamRole", "teamId")
SELECT
  generate_prefix_id('team_group'),
  cog."id",
  cog.temp_team_role::"TeamMemberRole",
  cog.temp_team_id
FROM created_org_groups cog;

-- Clean up temp columns
ALTER TABLE "OrganisationGroup" DROP COLUMN temp_team_id;
ALTER TABLE "OrganisationGroup" DROP COLUMN temp_team_role;

-- Create OrganisationMembers for each unique user-organisation combination
-- This ensures only one OrganisationMember per user per organisation, even if they belong to multiple teams
INSERT INTO "OrganisationMember" ("id", "createdAt", "updatedAt", "userId", "organisationId")
SELECT DISTINCT
  generate_prefix_id('member'),
  MIN(tm."createdAt"),
  NOW(),
  tm."userId",
  t."organisationId"
FROM "TeamMember" tm
JOIN "Team" t ON t."id" = tm."teamId"
GROUP BY tm."userId", t."organisationId";

-- Create OrganisationMembers for Organisations with 0 members
-- This can only occur for platform/enterprise/earlyAdopter/individual plans where they have 0 teams
-- So we create an OrganisationMember for the owner user
INSERT INTO "OrganisationMember" ("id", "createdAt", "updatedAt", "userId", "organisationId")
SELECT
  generate_prefix_id('member'),
  NOW(),
  NOW(),
  o."ownerUserId",
  o."id"
FROM "Organisation" o
WHERE o."id" NOT IN (SELECT "organisationId" FROM "OrganisationMember");

-- Add users to the appropriate INTERNAL_TEAM groups based on their team membership and role
-- This creates OrganisationGroupMember records to link users to their team-specific groups
-- Skip organisation owners as they are handled separately
INSERT INTO "OrganisationGroupMember" ("id", "groupId", "organisationMemberId")
SELECT
  generate_prefix_id('group_member'),
  og."id",
  om."id"
FROM "TeamMember" tm
JOIN "Team" t ON t."id" = tm."teamId"
JOIN "Organisation" o ON o."id" = t."organisationId"
JOIN "OrganisationMember" om ON om."userId" = tm."userId" AND om."organisationId" = t."organisationId"
JOIN "TeamGroup" tg ON tg."teamId" = t."id" AND tg."teamRole" = tm."role"
JOIN "OrganisationGroup" og ON og."id" = tg."organisationGroupId" AND og."type" = 'INTERNAL_TEAM'::"OrganisationGroupType"
WHERE tm."userId" != o."ownerUserId";

-- Add organisation owners to the INTERNAL_ORGANISATION ADMIN group
INSERT INTO "OrganisationGroupMember" ("id", "groupId", "organisationMemberId")
SELECT
  generate_prefix_id('group_member'),
  og."id",
  om."id"
FROM "Organisation" o
JOIN "OrganisationMember" om ON om."organisationId" = o."id" AND om."userId" = o."ownerUserId"
JOIN "OrganisationGroup" og ON og."organisationId" = o."id"
  AND og."type" = 'INTERNAL_ORGANISATION'::"OrganisationGroupType"
  AND og."organisationRole" = 'ADMIN'::"OrganisationMemberRole";

-- Add all other organisation members to the INTERNAL_ORGANISATION MEMBER group
INSERT INTO "OrganisationGroupMember" ("id", "groupId", "organisationMemberId")
SELECT
  generate_prefix_id('group_member'),
  og."id",
  om."id"
FROM "Organisation" o
JOIN "OrganisationMember" om ON om."organisationId" = o."id" AND om."userId" != o."ownerUserId"
JOIN "OrganisationGroup" og ON og."organisationId" = o."id"
  AND og."type" = 'INTERNAL_ORGANISATION'::"OrganisationGroupType"
  AND og."organisationRole" = 'MEMBER'::"OrganisationMemberRole";

-- Migrate team subscriptions to the organisation level
UPDATE "Subscription" s
SET "organisationId" = t."organisationId"
FROM "Team" t
WHERE s."teamId" = t."id" AND s."teamId" IS NOT NULL;

-- Drop team member related entities (DropForeignKey/DropTable)
ALTER TABLE "TeamMember" DROP CONSTRAINT "TeamMember_teamId_fkey";
ALTER TABLE "TeamMember" DROP CONSTRAINT "TeamMember_userId_fkey";
DROP TABLE "TeamMember";

-- Drop temp columns
ALTER TABLE "Organisation" DROP COLUMN "teamId";
ALTER TABLE "Team" DROP COLUMN "isPersonal";
ALTER TABLE "TeamGlobalSettings" DROP COLUMN "teamId";
ALTER TABLE "OrganisationGlobalSettings" DROP COLUMN "organisationId";

-- REAPPLY NOT NULL to any temporary nullable columns
ALTER TABLE "Team" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "Team" ALTER COLUMN "teamGlobalSettingsId" SET NOT NULL;
ALTER TABLE "Subscription" ALTER COLUMN "organisationId" SET NOT NULL;
ALTER TABLE "Organisation" ALTER COLUMN "organisationClaimId" SET NOT NULL;
ALTER TABLE "Organisation" ALTER COLUMN "organisationGlobalSettingsId" SET NOT NULL;

-- Drop columns
ALTER TABLE "Team" DROP COLUMN "ownerUserId";
ALTER TABLE "User" DROP COLUMN "url";
ALTER TABLE "Subscription" DROP COLUMN "teamId";
ALTER TABLE "Subscription" DROP COLUMN "userId";
