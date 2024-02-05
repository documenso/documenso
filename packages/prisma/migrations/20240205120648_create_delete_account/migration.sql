-- Create deleted@documenso.com
INSERT INTO
  "public"."User" (
    "email",
    "emailVerified",
    "password",
    "createdAt",
    "updatedAt",
    "lastSignedIn",
    "roles",
    "identityProvider",
    "twoFactorEnabled"
  )
VALUES
  (
    'deleted@documenso.com',
    '2024-02-05 11:58:39.668 UTC',
    NULL,
    '2024-02-05 11:58:39.670 UTC',
    '2024-02-05 11:58:39.670 UTC',
    '2024-02-05 11:58:39.670 UTC',
    ARRAY['USER'::TEXT]::"public"."Role" [],
    CAST('GOOGLE'::TEXT AS "public"."IdentityProvider"),
    FALSE
  )
