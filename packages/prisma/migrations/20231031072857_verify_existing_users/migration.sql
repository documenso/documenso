UPDATE "User"
SET "emailVerified" = CURRENT_TIMESTAMP
WHERE "emailVerified" IS NULL;
