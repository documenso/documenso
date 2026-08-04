-- CreateTable
CREATE TABLE "FontAsset" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "dataType" "DocumentDataType" NOT NULL,
    "data" TEXT NOT NULL,
    "userId" INTEGER,
    "teamId" INTEGER,
    "organisationId" TEXT,

    CONSTRAINT "FontAsset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FontAsset_single_owner_check" CHECK (
        (CASE WHEN "userId" IS NULL THEN 0 ELSE 1 END) +
        (CASE WHEN "teamId" IS NULL THEN 0 ELSE 1 END) +
        (CASE WHEN "organisationId" IS NULL THEN 0 ELSE 1 END) = 1
    )
);

-- CreateIndex
CREATE INDEX "FontAsset_userId_idx" ON "FontAsset"("userId");

-- CreateIndex
CREATE INDEX "FontAsset_teamId_idx" ON "FontAsset"("teamId");

-- CreateIndex
CREATE INDEX "FontAsset_organisationId_idx" ON "FontAsset"("organisationId");

-- AddForeignKey
ALTER TABLE "FontAsset" ADD CONSTRAINT "FontAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FontAsset" ADD CONSTRAINT "FontAsset_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FontAsset" ADD CONSTRAINT "FontAsset_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
