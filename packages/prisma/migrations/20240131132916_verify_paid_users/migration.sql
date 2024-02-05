UPDATE "User"
SET "emailVerified" = NOW()
FROM "Subscription"
WHERE "User"."id" = "Subscription"."userId"
AND "Subscription"."status" = 'ACTIVE'
AND "User"."emailVerified" IS NULL
