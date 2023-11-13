INSERT INTO "User" ("email", "name") VALUES (
  'support@progiciel.co',
  'Service Account'
) ON CONFLICT DO NOTHING;
