-- Migrate DOCUMENSO users to have proper Account records
DO $$
BEGIN
  INSERT INTO "Account" (
    "id",
    "userId",
    "type",
    "provider",
    "providerAccountId",
    "password",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid()::text,
    u.id,
    'legacy',
    'credential',
    u.email,
    u.password,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM "User" u
  LEFT JOIN "Account" a ON a."userId" = u.id AND a."provider" = 'documenso'
  WHERE
    u."identityProvider" = 'DOCUMENSO'
    AND a.id IS NULL;
END $$;
