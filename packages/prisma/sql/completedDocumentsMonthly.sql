SELECT
  DATE_TRUNC('month', "updatedAt") AS "month",
  COUNT("id") as "count",
  SUM(COUNT("id")) OVER (ORDER BY DATE_TRUNC('month', "updatedAt")) as "cume_count"
FROM "Document"
WHERE "status" = 'COMPLETED'
GROUP BY "month"
ORDER BY "month" DESC
LIMIT 12
