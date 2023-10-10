INSERT INTO "User" ("email", "name") VALUES (
  'serviceaccount@documenso.com',
  'Service Account'
) ON CONFLICT DO NOTHING;
