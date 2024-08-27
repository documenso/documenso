SELECT
  DATE_TRUNC('MONTH', "User"."createdAt") AS "month",
  COUNT("id") AS "count",
  SUM(COUNT("id")) OVER (ORDER BY DATE_TRUNC('MONTH', "User"."createdAt")) AS "cume_count"
FROM "User"
GROUP BY "month"
ORDER BY "month" DESC
LIMIT 12;
