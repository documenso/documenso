SELECT
  DATE_TRUNC('month', "Document"."createdAt") AS "month",
  COUNT(DISTINCT "Document"."userId") as "count",
  COUNT(DISTINCT CASE WHEN "Document"."status" = 'COMPLETED' THEN "Document"."userId" END) as "signed_count"
FROM "Document"
GROUP BY "month"
ORDER BY "month" DESC
LIMIT 12
