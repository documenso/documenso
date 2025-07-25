-- CreateEnum
CREATE TYPE "IdentityProvider" AS ENUM ('DOCUMENSO', 'GOOGLE', 'OIDC');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "UserSecurityAuditLogType" AS ENUM ('ACCOUNT_PROFILE_UPDATE', 'ACCOUNT_SSO_LINK', 'AUTH_2FA_DISABLE', 'AUTH_2FA_ENABLE', 'PASSKEY_CREATED', 'PASSKEY_DELETED', 'PASSKEY_UPDATED', 'PASSWORD_RESET', 'PASSWORD_UPDATE', 'SESSION_REVOKED', 'SIGN_OUT', 'SIGN_IN', 'SIGN_IN_FAIL', 'SIGN_IN_2FA_FAIL', 'SIGN_IN_PASSKEY_FAIL');

-- CreateEnum
CREATE TYPE "WebhookTriggerEvents" AS ENUM ('DOCUMENT_CREATED', 'DOCUMENT_SENT', 'DOCUMENT_OPENED', 'DOCUMENT_SIGNED', 'DOCUMENT_COMPLETED', 'DOCUMENT_REJECTED', 'DOCUMENT_CANCELLED');

-- CreateEnum
CREATE TYPE "WebhookCallStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ApiTokenAlgorithm" AS ENUM ('SHA512');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'PENDING', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('DOCUMENT', 'TEMPLATE', 'TEMPLATE_DIRECT_LINK');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('EVERYONE', 'MANAGER_AND_ABOVE', 'ADMIN');

-- CreateEnum
CREATE TYPE "FolderType" AS ENUM ('DOCUMENT', 'TEMPLATE');

-- CreateEnum
CREATE TYPE "DocumentDataType" AS ENUM ('S3_PATH', 'BYTES', 'BYTES_64');

-- CreateEnum
CREATE TYPE "DocumentSigningOrder" AS ENUM ('PARALLEL', 'SEQUENTIAL');

-- CreateEnum
CREATE TYPE "DocumentDistributionMethod" AS ENUM ('EMAIL', 'NONE');

-- CreateEnum
CREATE TYPE "ReadStatus" AS ENUM ('NOT_OPENED', 'OPENED');

-- CreateEnum
CREATE TYPE "SendStatus" AS ENUM ('NOT_SENT', 'SENT');

-- CreateEnum
CREATE TYPE "SigningStatus" AS ENUM ('NOT_SIGNED', 'SIGNED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RecipientRole" AS ENUM ('CC', 'SIGNER', 'VIEWER', 'APPROVER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('SIGNATURE', 'FREE_SIGNATURE', 'INITIALS', 'NAME', 'EMAIL', 'DATE', 'TEXT', 'NUMBER', 'RADIO', 'CHECKBOX', 'DROPDOWN');

-- CreateEnum
CREATE TYPE "OrganisationType" AS ENUM ('PERSONAL', 'ORGANISATION');

-- CreateEnum
CREATE TYPE "OrganisationGroupType" AS ENUM ('INTERNAL_ORGANISATION', 'INTERNAL_TEAM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "OrganisationMemberRole" AS ENUM ('ADMIN', 'MANAGER', 'MEMBER');

-- CreateEnum
CREATE TYPE "TeamMemberRole" AS ENUM ('ADMIN', 'MANAGER', 'MEMBER');

-- CreateEnum
CREATE TYPE "OrganisationMemberInviteStatus" AS ENUM ('ACCEPTED', 'PENDING', 'DECLINED');

-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BackgroundJobTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "OrganisationDomainAuditLogType" AS ENUM ('DOMAIN_ADDED', 'DOMAIN_REMOVED', 'USER_AUTO_ASSIGNED', 'BULK_ASSIGNMENT_COMPLETED', 'LOGIN_ASSIGNMENT_COMPLETED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "password" TEXT,
    "source" TEXT,
    "signature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSignedIn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roles" "Role"[] DEFAULT ARRAY['USER']::"Role"[],
    "identityProvider" "IdentityProvider" NOT NULL DEFAULT 'DOCUMENSO',
    "avatarImageId" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorBackupCodes" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamProfile" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "teamId" INTEGER NOT NULL,
    "bio" TEXT,

    CONSTRAINT "TeamProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSecurityAuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "UserSecurityAuditLogType" NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "UserSecurityAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiry" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passkey" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "credentialId" BYTEA NOT NULL,
    "credentialPublicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL,
    "credentialDeviceType" TEXT NOT NULL,
    "credentialBackedUp" BOOLEAN NOT NULL,
    "transports" TEXT[],

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnonymousVerificationToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnonymousVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" SERIAL NOT NULL,
    "secondaryId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "eventTriggers" "WebhookTriggerEvents"[],
    "secret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookCall" (
    "id" TEXT NOT NULL,
    "status" "WebhookCallStatus" NOT NULL,
    "url" TEXT NOT NULL,
    "event" "WebhookTriggerEvents" NOT NULL,
    "requestBody" JSONB NOT NULL,
    "responseCode" INTEGER NOT NULL,
    "responseHeaders" JSONB,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "webhookId" TEXT NOT NULL,

    CONSTRAINT "WebhookCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiToken" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "algorithm" "ApiTokenAlgorithm" NOT NULL DEFAULT 'SHA512',
    "expires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "teamId" INTEGER NOT NULL,

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "planId" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "created_at" INTEGER,
    "ext_expires_in" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "password" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'EVERYONE',
    "type" "FolderType" NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" SERIAL NOT NULL,
    "qrToken" TEXT,
    "externalId" TEXT,
    "userId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "authOptions" JSONB,
    "formValues" JSONB,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'EVERYONE',
    "title" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "documentDataId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "templateId" INTEGER,
    "source" "DocumentSource" NOT NULL,
    "useLegacyFieldInsertion" BOOLEAN NOT NULL DEFAULT false,
    "folderId" TEXT,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAuditLog" (
    "id" TEXT NOT NULL,
    "documentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "userId" INTEGER,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "DocumentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentData" (
    "id" TEXT NOT NULL,
    "type" "DocumentDataType" NOT NULL,
    "data" TEXT NOT NULL,
    "initialData" TEXT NOT NULL,

    CONSTRAINT "DocumentData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentMeta" (
    "id" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT,
    "timezone" TEXT DEFAULT 'Etc/UTC',
    "password" TEXT,
    "dateFormat" TEXT DEFAULT 'yyyy-MM-dd hh:mm a',
    "documentId" INTEGER NOT NULL,
    "redirectUrl" TEXT,
    "signingOrder" "DocumentSigningOrder" NOT NULL DEFAULT 'PARALLEL',
    "allowDictateNextSigner" BOOLEAN NOT NULL DEFAULT false,
    "typedSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "uploadSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "drawSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'en',
    "distributionMethod" "DocumentDistributionMethod" NOT NULL DEFAULT 'EMAIL',
    "emailSettings" JSONB,

    CONSTRAINT "DocumentMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipient" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER,
    "templateId" INTEGER,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL DEFAULT '',
    "token" TEXT NOT NULL,
    "documentDeletedAt" TIMESTAMP(3),
    "expired" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "authOptions" JSONB,
    "signingOrder" INTEGER,
    "rejectionReason" TEXT,
    "role" "RecipientRole" NOT NULL DEFAULT 'SIGNER',
    "readStatus" "ReadStatus" NOT NULL DEFAULT 'NOT_OPENED',
    "signingStatus" "SigningStatus" NOT NULL DEFAULT 'NOT_SIGNED',
    "sendStatus" "SendStatus" NOT NULL DEFAULT 'NOT_SENT',

    CONSTRAINT "Recipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Field" (
    "id" SERIAL NOT NULL,
    "secondaryId" TEXT NOT NULL,
    "documentId" INTEGER,
    "templateId" INTEGER,
    "recipientId" INTEGER NOT NULL,
    "type" "FieldType" NOT NULL,
    "page" INTEGER NOT NULL,
    "positionX" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "positionY" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "width" DECIMAL(65,30) NOT NULL DEFAULT -1,
    "height" DECIMAL(65,30) NOT NULL DEFAULT -1,
    "customText" TEXT NOT NULL,
    "inserted" BOOLEAN NOT NULL,
    "fieldMeta" JSONB,

    CONSTRAINT "Field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" SERIAL NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientId" INTEGER NOT NULL,
    "fieldId" INTEGER NOT NULL,
    "signatureImageAsBase64" TEXT,
    "typedSignature" TEXT,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentShareLink" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "documentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentShareLink_pkey" PRIMARY KEY ("id")
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
    "organisationClaimId" TEXT NOT NULL,
    "ownerUserId" INTEGER NOT NULL,
    "organisationGlobalSettingsId" TEXT NOT NULL,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationDomainAccess" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationDomainAccess_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "OrganisationGlobalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamGlobalSettings" (
    "id" TEXT NOT NULL,
    "documentVisibility" "DocumentVisibility",
    "documentLanguage" TEXT,
    "includeSenderDetails" BOOLEAN,
    "includeSigningCertificate" BOOLEAN,
    "typedSignatureEnabled" BOOLEAN,
    "uploadSignatureEnabled" BOOLEAN,
    "drawSignatureEnabled" BOOLEAN,
    "brandingEnabled" BOOLEAN,
    "brandingLogo" TEXT,
    "brandingUrl" TEXT,
    "brandingCompanyDetails" TEXT,

    CONSTRAINT "TeamGlobalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avatarImageId" TEXT,
    "organisationId" TEXT NOT NULL,
    "teamGlobalSettingsId" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
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
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamEmailVerification_pkey" PRIMARY KEY ("teamId")
);

-- CreateTable
CREATE TABLE "TemplateMeta" (
    "id" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT,
    "timezone" TEXT DEFAULT 'Etc/UTC',
    "password" TEXT,
    "dateFormat" TEXT DEFAULT 'yyyy-MM-dd hh:mm a',
    "signingOrder" "DocumentSigningOrder" DEFAULT 'PARALLEL',
    "allowDictateNextSigner" BOOLEAN NOT NULL DEFAULT false,
    "distributionMethod" "DocumentDistributionMethod" NOT NULL DEFAULT 'EMAIL',
    "typedSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "uploadSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "drawSignatureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "templateId" INTEGER NOT NULL,
    "redirectUrl" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "emailSettings" JSONB,

    CONSTRAINT "TemplateMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT,
    "type" "TemplateType" NOT NULL DEFAULT 'PRIVATE',
    "title" TEXT NOT NULL,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'EVERYONE',
    "authOptions" JSONB,
    "templateDocumentDataId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicTitle" TEXT NOT NULL DEFAULT '',
    "publicDescription" TEXT NOT NULL DEFAULT '',
    "useLegacyFieldInsertion" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "folderId" TEXT,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateDirectLink" (
    "id" TEXT NOT NULL,
    "templateId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabled" BOOLEAN NOT NULL,
    "directTemplateRecipientId" INTEGER NOT NULL,

    CONSTRAINT "TemplateDirectLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB NOT NULL,
    "lastModifiedByUserId" INTEGER,
    "lastModifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "retried" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "lastRetriedAt" TIMESTAMP(3),

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJobTask" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BackgroundJobTaskStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "retried" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "jobId" TEXT NOT NULL,

    CONSTRAINT "BackgroundJobTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationDomainAuditLog" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "OrganisationDomainAuditLogType" NOT NULL,
    "data" JSONB NOT NULL,
    "userId" INTEGER,
    "userName" TEXT,
    "userEmail" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "OrganisationDomainAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvatarImage" (
    "id" TEXT NOT NULL,
    "bytes" TEXT NOT NULL,

    CONSTRAINT "AvatarImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TeamProfile_teamId_key" ON "TeamProfile"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "AnonymousVerificationToken_id_key" ON "AnonymousVerificationToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AnonymousVerificationToken_token_key" ON "AnonymousVerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_secondaryId_key" ON "VerificationToken"("secondaryId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_token_key" ON "ApiToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_planId_key" ON "Subscription"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organisationId_key" ON "Subscription"("organisationId");

-- CreateIndex
CREATE INDEX "Subscription_organisationId_idx" ON "Subscription"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Folder_userId_idx" ON "Folder"("userId");

-- CreateIndex
CREATE INDEX "Folder_teamId_idx" ON "Folder"("teamId");

-- CreateIndex
CREATE INDEX "Folder_parentId_idx" ON "Folder"("parentId");

-- CreateIndex
CREATE INDEX "Folder_type_idx" ON "Folder"("type");

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Document_folderId_idx" ON "Document"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_documentDataId_key" ON "Document"("documentDataId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentMeta_documentId_key" ON "DocumentMeta"("documentId");

-- CreateIndex
CREATE INDEX "Recipient_documentId_idx" ON "Recipient"("documentId");

-- CreateIndex
CREATE INDEX "Recipient_templateId_idx" ON "Recipient"("templateId");

-- CreateIndex
CREATE INDEX "Recipient_token_idx" ON "Recipient"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Recipient_documentId_email_key" ON "Recipient"("documentId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Recipient_templateId_email_key" ON "Recipient"("templateId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Field_secondaryId_key" ON "Field"("secondaryId");

-- CreateIndex
CREATE INDEX "Field_documentId_idx" ON "Field"("documentId");

-- CreateIndex
CREATE INDEX "Field_templateId_idx" ON "Field"("templateId");

-- CreateIndex
CREATE INDEX "Field_recipientId_idx" ON "Field"("recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "Signature_fieldId_key" ON "Signature"("fieldId");

-- CreateIndex
CREATE INDEX "Signature_recipientId_idx" ON "Signature"("recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentShareLink_slug_key" ON "DocumentShareLink"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentShareLink_documentId_email_key" ON "DocumentShareLink"("documentId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_url_key" ON "Organisation"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_customerId_key" ON "Organisation"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_organisationClaimId_key" ON "Organisation"("organisationClaimId");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_organisationGlobalSettingsId_key" ON "Organisation"("organisationGlobalSettingsId");

-- CreateIndex
CREATE INDEX "OrganisationDomainAccess_domain_idx" ON "OrganisationDomainAccess"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationDomainAccess_organisationId_domain_key" ON "OrganisationDomainAccess"("organisationId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationMember_userId_organisationId_key" ON "OrganisationMember"("userId", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationMemberInvite_token_key" ON "OrganisationMemberInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationGroupMember_organisationMemberId_groupId_key" ON "OrganisationGroupMember"("organisationMemberId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamGroup_teamId_organisationGroupId_key" ON "TeamGroup"("teamId", "organisationGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_url_key" ON "Team"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Team_teamGlobalSettingsId_key" ON "Team"("teamGlobalSettingsId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamEmail_teamId_key" ON "TeamEmail"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamEmail_email_key" ON "TeamEmail"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TeamEmailVerification_teamId_key" ON "TeamEmailVerification"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamEmailVerification_token_key" ON "TeamEmailVerification"("token");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateMeta_templateId_key" ON "TemplateMeta"("templateId");

-- CreateIndex
CREATE INDEX "Template_userId_idx" ON "Template"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Template_templateDocumentDataId_key" ON "Template"("templateDocumentDataId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateDirectLink_id_key" ON "TemplateDirectLink"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateDirectLink_templateId_key" ON "TemplateDirectLink"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateDirectLink_token_key" ON "TemplateDirectLink"("token");

-- CreateIndex
CREATE INDEX "OrganisationDomainAuditLog_organisationId_idx" ON "OrganisationDomainAuditLog"("organisationId");

-- CreateIndex
CREATE INDEX "OrganisationDomainAuditLog_type_idx" ON "OrganisationDomainAuditLog"("type");

-- CreateIndex
CREATE INDEX "OrganisationDomainAuditLog_createdAt_idx" ON "OrganisationDomainAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_avatarImageId_fkey" FOREIGN KEY ("avatarImageId") REFERENCES "AvatarImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamProfile" ADD CONSTRAINT "TeamProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSecurityAuditLog" ADD CONSTRAINT "UserSecurityAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookCall" ADD CONSTRAINT "WebhookCall_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_documentDataId_fkey" FOREIGN KEY ("documentDataId") REFERENCES "DocumentData"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAuditLog" ADD CONSTRAINT "DocumentAuditLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentMeta" ADD CONSTRAINT "DocumentMeta_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipient" ADD CONSTRAINT "Recipient_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipient" ADD CONSTRAINT "Recipient_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Field" ADD CONSTRAINT "Field_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Field" ADD CONSTRAINT "Field_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Field" ADD CONSTRAINT "Field_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentShareLink" ADD CONSTRAINT "DocumentShareLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_organisationClaimId_fkey" FOREIGN KEY ("organisationClaimId") REFERENCES "OrganisationClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_avatarImageId_fkey" FOREIGN KEY ("avatarImageId") REFERENCES "AvatarImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_organisationGlobalSettingsId_fkey" FOREIGN KEY ("organisationGlobalSettingsId") REFERENCES "OrganisationGlobalSettings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationDomainAccess" ADD CONSTRAINT "OrganisationDomainAccess_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "Team" ADD CONSTRAINT "Team_avatarImageId_fkey" FOREIGN KEY ("avatarImageId") REFERENCES "AvatarImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_teamGlobalSettingsId_fkey" FOREIGN KEY ("teamGlobalSettingsId") REFERENCES "TeamGlobalSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamEmail" ADD CONSTRAINT "TeamEmail_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamEmailVerification" ADD CONSTRAINT "TeamEmailVerification_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateMeta" ADD CONSTRAINT "TemplateMeta_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_templateDocumentDataId_fkey" FOREIGN KEY ("templateDocumentDataId") REFERENCES "DocumentData"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateDirectLink" ADD CONSTRAINT "TemplateDirectLink_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_lastModifiedByUserId_fkey" FOREIGN KEY ("lastModifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackgroundJobTask" ADD CONSTRAINT "BackgroundJobTask_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BackgroundJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationDomainAuditLog" ADD CONSTRAINT "OrganisationDomainAuditLog_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationDomainAuditLog" ADD CONSTRAINT "OrganisationDomainAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

