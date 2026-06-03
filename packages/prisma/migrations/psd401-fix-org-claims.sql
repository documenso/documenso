-- PSD401: Update all organisation claims to enterprise-level values
-- This ensures existing orgs get unlimited teams, members, and all feature flags
UPDATE "OrganisationClaim"
SET
  "teamCount" = 0,
  "memberCount" = 0,
  "envelopeItemCount" = 10,
  "flags" = jsonb_build_object(
    'unlimitedDocuments', true,
    'allowCustomBranding', true,
    'hidePoweredBy', true,
    'emailDomains', true,
    'embedAuthoring', true,
    'embedAuthoringWhiteLabel', true,
    'embedSigning', true,
    'embedSigningWhiteLabel', true,
    'cfr21', true,
    'hipaa', true,
    'authenticationPortal', true,
    'allowLegacyEnvelopes', true,
    'signingReminders', true
  );
