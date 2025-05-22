-- Insert default claims
INSERT INTO "SubscriptionClaim" (id, name, "teamCount", "memberCount", locked, flags, "createdAt", "updatedAt")
VALUES
  ('free', 'Free', 1, 1, true, '{}', NOW(), NOW()),
  ('individual', 'Individual', 1, 1, true, '{"unlimitedDocuments": true}', NOW(), NOW()),
  ('pro', 'Teams', 1, 5, true, '{"memberStripeSync": true, "unlimitedDocuments": true, "embedSigning": true}', NOW(), NOW()),
  ('platform', 'Platform', 1, 0, true, '{"unlimitedDocuments": true, "embedAuthoring": false, "embedAuthoringWhiteLabel": true, "embedSigning": false, "embedSigningWhiteLabel": true}', NOW(), NOW()),
  ('enterprise', 'Enterprise', 0, 0, true, '{"unlimitedDocuments": true, "embedAuthoring": true, "embedAuthoringWhiteLabel": true, "embedSigning": true, "embedSigningWhiteLabel": true, "cfr21": true}', NOW(), NOW()),
  ('early-adopter', 'Early Adopter', 0, 0, true, '{"unlimitedDocuments": true, "embedAuthoring": false, "embedAuthoringWhiteLabel": true, "embedSigning": false, "embedSigningWhiteLabel": true}', NOW(), NOW());
