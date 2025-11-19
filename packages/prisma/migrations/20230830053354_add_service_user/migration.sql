INSERT INTO "User" ("email", "name") VALUES (
  'serviceaccount@doku-seal.com',
  'Service Account'
) ON CONFLICT DO NOTHING;
