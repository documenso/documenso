-- CreateEnum
CREATE TYPE "AdminRuleMode" AS ENUM ('ENFORCE', 'MONITOR', 'DISABLED');

-- CreateTable
CREATE TABLE "AdminRule" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mode" "AdminRuleMode" NOT NULL,
    "trigger" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "priority" INTEGER NOT NULL,
    "stopOnMatch" BOOLEAN NOT NULL,
    "exemptOrganisationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "AdminRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRuleMatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" "AdminRuleMode" NOT NULL,
    "trigger" TEXT NOT NULL,
    "organisationId" TEXT,
    "envelopeId" TEXT,
    "eventSnapshot" JSONB NOT NULL,
    "actionsRun" JSONB NOT NULL,
    "ruleId" TEXT NOT NULL,
    "actorUserId" INTEGER,

    CONSTRAINT "AdminRuleMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminTag" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "userId" INTEGER,
    "organisationId" TEXT,
    "createdByUserId" INTEGER,
    "adminRuleId" TEXT,

    CONSTRAINT "AdminTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminRule_trigger_mode_priority_idx" ON "AdminRule"("trigger", "mode", "priority");

-- CreateIndex
CREATE INDEX "AdminRuleMatch_ruleId_createdAt_idx" ON "AdminRuleMatch"("ruleId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminRuleMatch_createdAt_idx" ON "AdminRuleMatch"("createdAt");

-- CreateIndex
CREATE INDEX "AdminTag_userId_idx" ON "AdminTag"("userId");

-- CreateIndex
CREATE INDEX "AdminTag_organisationId_idx" ON "AdminTag"("organisationId");

-- AddForeignKey
ALTER TABLE "AdminRuleMatch" ADD CONSTRAINT "AdminRuleMatch_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AdminRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRuleMatch" ADD CONSTRAINT "AdminRuleMatch_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTag" ADD CONSTRAINT "AdminTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTag" ADD CONSTRAINT "AdminTag_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTag" ADD CONSTRAINT "AdminTag_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTag" ADD CONSTRAINT "AdminTag_adminRuleId_fkey" FOREIGN KEY ("adminRuleId") REFERENCES "AdminRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
