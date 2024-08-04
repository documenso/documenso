SELECT
  DATE_TRUNC('month', "User"."createdAt") AS "month",
  COUNT(DISTINCT "Recipient"."email") as "count",
  SUM(COUNT(DISTINCT "Recipient"."email")) OVER (ORDER BY DATE_TRUNC('month', "User"."createdAt")) as "cume_count"
FROM "Recipient"
INNER JOIN "User" ON "Recipient"."email" = "User"."email"
WHERE "Recipient"."signedAt" IS NOT NULL
  AND "Recipient"."signedAt" < "User"."createdAt"
GROUP BY DATE_TRUNC('month', "User"."createdAt")
ORDER BY "month" DESC
