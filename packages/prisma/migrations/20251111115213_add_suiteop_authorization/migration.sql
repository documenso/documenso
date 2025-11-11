-- CreateTable
CREATE TABLE "SuiteOpAuthorization" (
    "id" SERIAL NOT NULL,
    "claimCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "apiTokenId" INTEGER NOT NULL,
    "plaintextToken" TEXT NOT NULL,

    CONSTRAINT "SuiteOpAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SuiteOpAuthorization_claimCode_key" ON "SuiteOpAuthorization"("claimCode");

-- CreateIndex
CREATE INDEX "SuiteOpAuthorization_claimCode_idx" ON "SuiteOpAuthorization"("claimCode");

-- CreateIndex
CREATE INDEX "SuiteOpAuthorization_userId_idx" ON "SuiteOpAuthorization"("userId");

-- AddForeignKey
ALTER TABLE "SuiteOpAuthorization" ADD CONSTRAINT "SuiteOpAuthorization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiteOpAuthorization" ADD CONSTRAINT "SuiteOpAuthorization_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiteOpAuthorization" ADD CONSTRAINT "SuiteOpAuthorization_apiTokenId_fkey" FOREIGN KEY ("apiTokenId") REFERENCES "ApiToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;



