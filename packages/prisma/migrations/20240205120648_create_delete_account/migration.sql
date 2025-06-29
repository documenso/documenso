-- Create deleted@documenso.com
DO $$
BEGIN  
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE "email" = 'deleted-account@documenso.com') THEN  
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
        'deleted-account@documenso.com',
        NOW(),
        NULL,
        NOW(),
        NOW(),
        NOW(),
        ARRAY['USER'::TEXT]::"Role" [],
        CAST('GOOGLE'::TEXT AS "IdentityProvider"),
        FALSE
      );
  END IF;  
END $$
