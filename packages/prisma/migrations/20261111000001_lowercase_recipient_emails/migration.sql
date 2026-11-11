-- Recipient emails are matched exactly against "User"."email", which is stored lowercase.
UPDATE "Recipient"
SET "email" = lower("email")
WHERE "email" <> lower("email");
