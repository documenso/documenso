-- Lowercase one "User" row per group of emails that differ only by case.
--
-- A group that already has a lowercase row is left alone, otherwise the oldest row is lowercased,
-- so this can never violate the unique constraint on "email". Rows left in mixed case are
-- duplicates of the lowercase row and need to be merged by hand.
UPDATE "User" AS u
SET "email" = lower(u."email")
WHERE u."email" <> lower(u."email")
  AND NOT EXISTS (
    SELECT 1
    FROM "User" AS o
    WHERE o."id" <> u."id"
      AND lower(o."email") = lower(u."email")
      AND (o."email" = lower(o."email") OR o."id" < u."id")
  );
