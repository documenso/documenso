-- CreateTable
CREATE TABLE "DocumentAccessToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "documentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAccessToken_token_key" ON "DocumentAccessToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAccessToken_documentId_key" ON "DocumentAccessToken"("documentId");

-- CreateIndex
CREATE INDEX "DocumentAccessToken_token_idx" ON "DocumentAccessToken"("token");

-- CreateIndex
CREATE INDEX "DocumentAccessToken_documentId_idx" ON "DocumentAccessToken"("documentId");

-- AddForeignKey
ALTER TABLE "DocumentAccessToken" ADD CONSTRAINT "DocumentAccessToken_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
