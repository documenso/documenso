-- CreateTable
CREATE TABLE "TeamGlobalSettings" (
    "teamId" INTEGER NOT NULL,
    "documentVisibility" "DocumentVisibility" NOT NULL DEFAULT 'EVERYONE',
    "includeSenderDetails" BOOLEAN NOT NULL DEFAULT true
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamGlobalSettings_teamId_key" ON "TeamGlobalSettings"("teamId");

-- AddForeignKey
ALTER TABLE "TeamGlobalSettings" ADD CONSTRAINT "TeamGlobalSettings_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
