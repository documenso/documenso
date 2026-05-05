-- AlterTable
-- Add the column with a temporary default of `true` so that all existing rows
-- (representing organisations created before this feature) are backfilled to
-- `true` — preserving the historical behaviour of creating personal
-- organisations for SSO-provisioned users.
ALTER TABLE "OrganisationAuthenticationPortal" ADD COLUMN "allowPersonalOrganisations" BOOLEAN NOT NULL DEFAULT true;

-- Switch the column default to `false` so that any organisations created from
-- now on opt out of personal-organisation creation by default.
ALTER TABLE "OrganisationAuthenticationPortal" ALTER COLUMN "allowPersonalOrganisations" SET DEFAULT false;
