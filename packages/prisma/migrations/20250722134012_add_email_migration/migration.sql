-- CreateTable
CREATE TABLE "UserTwoFactorEmailVerification" (
    "userId" INTEGER NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTwoFactorEmailVerification_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserTwoFactorEmailVerification" ADD CONSTRAINT "UserTwoFactorEmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
