-- CreateTable
CREATE TABLE "TwoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "TwoFactor_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TwoFactor" ADD CONSTRAINT "TwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  -- Then migrate two factor data
  INSERT INTO "TwoFactor" (
    "secret",
    "backupCodes",
    "userId"
  )
  SELECT
    u."twoFactorSecret",
    COALESCE(u."twoFactorBackupCodes", ''),
    u.id
  FROM "User" u
  LEFT JOIN "TwoFactor" tf ON tf."userId" = u.id
  WHERE
    u."twoFactorSecret" IS NOT NULL
    AND u."twoFactorEnabled" = true
    AND tf.id IS NULL;
END $$;
