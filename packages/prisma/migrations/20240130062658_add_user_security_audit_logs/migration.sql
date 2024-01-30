-- CreateEnum
CREATE TYPE "UserSecurityAuditLogType" AS ENUM ('ACCOUNT_CREATE', 'ACCOUNT_PROFILE_UPDATE', 'ACCOUNT_SSO_LINK', 'AUTH_2FA_DISABLE', 'AUTH_2FA_ENABLE', 'PASSWORD_RESET', 'PASSWORD_UPDATE', 'SIGN_OUT', 'SIGN_IN');

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

-- AddForeignKey
ALTER TABLE "UserSecurityAuditLog" ADD CONSTRAINT "UserSecurityAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
