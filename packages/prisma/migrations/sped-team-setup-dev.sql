-- SPED Team Setup for PSD401 Dev Environment
-- Creates: Special Education team, per-location org groups, team groups, folders, group memberships
-- Run on dev (10.0.70.60) first, then adapt for prod

BEGIN;

-- Bump org claim to allow more teams (was 0, which blocks UI team creation)
UPDATE "OrganisationClaim"
SET "teamCount" = 100, "memberCount" = 9999
WHERE id = (SELECT id FROM "OrganisationClaim" WHERE id LIKE 'org_claim_psd401%');

-- 1. Create TeamGlobalSettings for the SPED team
INSERT INTO "TeamGlobalSettings" (id) VALUES ('team_setting_sped');

-- 2. Create the Special Education team
INSERT INTO "Team" (name, url, "organisationId", "teamGlobalSettingsId")
VALUES ('Special Education', 'special-education', 'org_psd401district', 'team_setting_sped');

-- Store the new team ID for subsequent inserts
-- (Postgres autoincrement, we need to capture it)
DO $$
DECLARE
  sped_team_id INT;
  admin_user_id INT;
BEGIN
  SELECT id INTO sped_team_id FROM "Team" WHERE url = 'special-education';

  -- Get Reese's user ID for folder ownership
  SELECT id INTO admin_user_id FROM "User" WHERE LOWER(email) = 'herberr@psd401.net';

  -- 3. Create OrganisationGroups (CUSTOM type) for each location + admin group
  INSERT INTO "OrganisationGroup" (id, name, type, "organisationRole", "organisationId") VALUES
    ('org_group_sped_admin',              'Administration',              'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_artondale',          'Artondale Elementary',        'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_discovery',          'Discovery Elementary',        'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_evergreen',          'Evergreen Elementary',        'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_harbor_heights',     'Harbor Heights Elementary',   'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_minter_creek',       'Minter Creek Elementary',     'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_pioneer',            'Pioneer Elementary',          'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_purdy',              'Purdy Elementary',            'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_swift_water',        'Swift Water Elementary',      'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_vaughn',             'Vaughn Elementary',           'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_voyager',            'Voyager Elementary',          'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_goodman',            'Goodman Middle School',       'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_harbor_ridge',       'Harbor Ridge Middle School',  'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_key_peninsula',      'Key Peninsula Middle School', 'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_kopachuck',          'Kopachuck Middle School',     'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_gig_harbor_hs',      'Gig Harbor High School',      'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_henderson_bay_hs',   'Henderson Bay High School',   'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_peninsula_hs',       'Peninsula High School',       'CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_ctp',                'Community Transition Program','CUSTOM', 'MEMBER', 'org_psd401district'),
    ('org_group_sped_district_wide',      'District Wide Support',       'CUSTOM', 'MEMBER', 'org_psd401district');

  -- 4. Create TeamGroups linking org groups to the SPED team
  -- Admin group gets ADMIN role, all location groups get MEMBER role
  INSERT INTO "TeamGroup" (id, "organisationGroupId", "teamRole", "teamId") VALUES
    ('team_group_sped_admin',             'org_group_sped_admin',              'ADMIN',   sped_team_id),
    ('team_group_sped_artondale',         'org_group_sped_artondale',          'MEMBER',  sped_team_id),
    ('team_group_sped_discovery',         'org_group_sped_discovery',          'MEMBER',  sped_team_id),
    ('team_group_sped_evergreen',         'org_group_sped_evergreen',          'MEMBER',  sped_team_id),
    ('team_group_sped_harbor_heights',    'org_group_sped_harbor_heights',     'MEMBER',  sped_team_id),
    ('team_group_sped_minter_creek',      'org_group_sped_minter_creek',       'MEMBER',  sped_team_id),
    ('team_group_sped_pioneer',           'org_group_sped_pioneer',            'MEMBER',  sped_team_id),
    ('team_group_sped_purdy',             'org_group_sped_purdy',              'MEMBER',  sped_team_id),
    ('team_group_sped_swift_water',       'org_group_sped_swift_water',        'MEMBER',  sped_team_id),
    ('team_group_sped_vaughn',            'org_group_sped_vaughn',             'MEMBER',  sped_team_id),
    ('team_group_sped_voyager',           'org_group_sped_voyager',            'MEMBER',  sped_team_id),
    ('team_group_sped_goodman',           'org_group_sped_goodman',            'MEMBER',  sped_team_id),
    ('team_group_sped_harbor_ridge',      'org_group_sped_harbor_ridge',       'MEMBER',  sped_team_id),
    ('team_group_sped_key_peninsula',     'org_group_sped_key_peninsula',      'MEMBER',  sped_team_id),
    ('team_group_sped_kopachuck',         'org_group_sped_kopachuck',          'MEMBER',  sped_team_id),
    ('team_group_sped_gig_harbor_hs',     'org_group_sped_gig_harbor_hs',      'MEMBER',  sped_team_id),
    ('team_group_sped_henderson_bay_hs',  'org_group_sped_henderson_bay_hs',   'MEMBER',  sped_team_id),
    ('team_group_sped_peninsula_hs',      'org_group_sped_peninsula_hs',       'MEMBER',  sped_team_id),
    ('team_group_sped_ctp',              'org_group_sped_ctp',                'MEMBER',  sped_team_id),
    ('team_group_sped_district_wide',    'org_group_sped_district_wide',      'MEMBER',  sped_team_id);

  -- Also link the org-level admin and manager groups so org admins/managers can access SPED team
  INSERT INTO "TeamGroup" (id, "organisationGroupId", "teamRole", "teamId") VALUES
    ('team_group_sped_orgadmin',  'org_group_psd401_admin',   'ADMIN',   sped_team_id),
    ('team_group_sped_orgmanager','org_group_psd401_manager',  'ADMIN',   sped_team_id);

  -- 5. Create Folders for each location (type DOCUMENT)
  -- Each folder restricted to its location group + admin group via allowedGroupIds
  INSERT INTO "Folder" (id, name, "userId", "teamId", type, visibility, "allowedGroupIds") VALUES
    ('sped_folder_artondale',       'Artondale Elementary',        admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_artondale', 'org_group_sped_admin']),
    ('sped_folder_discovery',       'Discovery Elementary',        admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_discovery', 'org_group_sped_admin']),
    ('sped_folder_evergreen',       'Evergreen Elementary',        admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_evergreen', 'org_group_sped_admin']),
    ('sped_folder_harbor_heights',  'Harbor Heights Elementary',   admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_harbor_heights', 'org_group_sped_admin']),
    ('sped_folder_minter_creek',    'Minter Creek Elementary',     admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_minter_creek', 'org_group_sped_admin']),
    ('sped_folder_pioneer',         'Pioneer Elementary',          admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_pioneer', 'org_group_sped_admin']),
    ('sped_folder_purdy',           'Purdy Elementary',            admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_purdy', 'org_group_sped_admin']),
    ('sped_folder_swift_water',     'Swift Water Elementary',      admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_swift_water', 'org_group_sped_admin']),
    ('sped_folder_vaughn',          'Vaughn Elementary',           admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_vaughn', 'org_group_sped_admin']),
    ('sped_folder_voyager',         'Voyager Elementary',          admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_voyager', 'org_group_sped_admin']),
    ('sped_folder_goodman',         'Goodman Middle School',       admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_goodman', 'org_group_sped_admin']),
    ('sped_folder_harbor_ridge',    'Harbor Ridge Middle School',  admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_harbor_ridge', 'org_group_sped_admin']),
    ('sped_folder_key_peninsula',   'Key Peninsula Middle School', admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_key_peninsula', 'org_group_sped_admin']),
    ('sped_folder_kopachuck',       'Kopachuck Middle School',     admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_kopachuck', 'org_group_sped_admin']),
    ('sped_folder_gig_harbor_hs',   'Gig Harbor High School',      admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_gig_harbor_hs', 'org_group_sped_admin']),
    ('sped_folder_henderson_bay_hs','Henderson Bay High School',   admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_henderson_bay_hs', 'org_group_sped_admin']),
    ('sped_folder_peninsula_hs',    'Peninsula High School',       admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_peninsula_hs', 'org_group_sped_admin']),
    ('sped_folder_ctp',             'Community Transition Program',admin_user_id, sped_team_id, 'DOCUMENT', 'EVERYONE', ARRAY['org_group_sped_ctp', 'org_group_sped_admin']);

  -- 6. Add group memberships for staff who have accounts on dev
  -- Admin group: Administration & Clerical staff + District Wide + Reese
  -- Only inserting for users who exist in the system

  -- Admin group members (Administration & Clerical + District Wide)
  -- rushj@psd401.net (Janna Rush - Director)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_admin_rushj', 'org_group_sped_admin', id FROM "OrganisationMember" WHERE "userId" = 16 AND "organisationId" = 'org_psd401district';
  -- mccutcheonc@psd401.net (Catherine McCutcheon - Coordinator)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_admin_mccutcheonc', 'org_group_sped_admin', id FROM "OrganisationMember" WHERE "userId" = 54 AND "organisationId" = 'org_psd401district';
  -- raineyk@psd401.net (Kiona Rainey - Admin Secretary)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_admin_raineyk', 'org_group_sped_admin', id FROM "OrganisationMember" WHERE "userId" = 18 AND "organisationId" = 'org_psd401district';
  -- chonzenaa@psd401.net (Amy Chonzena - Compliance)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_admin_chonzenaa', 'org_group_sped_admin', id FROM "OrganisationMember" WHERE "userId" = 20 AND "organisationId" = 'org_psd401district';
  -- herberr@psd401.net (Reese)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_admin_herberr', 'org_group_sped_admin', id FROM "OrganisationMember" WHERE "userId" = 10 AND "organisationId" = 'org_psd401district';
  -- marina@psd401.net (Amy Marin - District Wide Child Find SLP)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_dw_marina', 'org_group_sped_district_wide', id FROM "OrganisationMember" WHERE "userId" = 64 AND "organisationId" = 'org_psd401district';
  -- fukujiw@psd401.net (Warren Fukuji - District Wide Itinerant + Discovery)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_dw_fukujiw', 'org_group_sped_district_wide', id FROM "OrganisationMember" WHERE "userId" = 33 AND "organisationId" = 'org_psd401district';

  -- Location group members (only users who exist on dev)

  -- Artondale: bonnerc(86) is actually Evergreen... let me re-check the roster
  -- Actually bonnerc is Evergreen + Key Peninsula. Let me be precise.

  -- Discovery: fukujiw(33), lewisg(44)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_disc_fukujiw', 'org_group_sped_discovery', id FROM "OrganisationMember" WHERE "userId" = 33 AND "organisationId" = 'org_psd401district';
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_disc_lewisg', 'org_group_sped_discovery', id FROM "OrganisationMember" WHERE "userId" = 44 AND "organisationId" = 'org_psd401district';

  -- Evergreen: bonnerc(86)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_ever_bonnerc', 'org_group_sped_evergreen', id FROM "OrganisationMember" WHERE "userId" = 86 AND "organisationId" = 'org_psd401district';

  -- Harbor Heights: jubbk(67)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_hh_jubbk', 'org_group_sped_harbor_heights', id FROM "OrganisationMember" WHERE "userId" = 67 AND "organisationId" = 'org_psd401district';

  -- Pioneer: cremar? No, cremar is Peninsula HS. Let me be precise per roster.
  -- Pioneer roster: robersone, kvasnickad, stacyf, johannesj, rollinsl, yellowleeskm, eastl
  -- None of these have accounts on dev.

  -- Goodman MS: lewisg(44)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_good_lewisg', 'org_group_sped_goodman', id FROM "OrganisationMember" WHERE "userId" = 44 AND "organisationId" = 'org_psd401district';

  -- Harbor Ridge MS: boyerl(66)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_hr_boyerl', 'org_group_sped_harbor_ridge', id FROM "OrganisationMember" WHERE "userId" = 66 AND "organisationId" = 'org_psd401district';

  -- Key Peninsula MS: bonnerc(86)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_kp_bonnerc', 'org_group_sped_key_peninsula', id FROM "OrganisationMember" WHERE "userId" = 86 AND "organisationId" = 'org_psd401district';

  -- Kopachuck MS: collenj(99)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_kop_collenj', 'org_group_sped_kopachuck', id FROM "OrganisationMember" WHERE "userId" = 99 AND "organisationId" = 'org_psd401district';

  -- Gig Harbor HS: cuzzettocm(51), elliottj(43)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_ghhs_cuzzettocm', 'org_group_sped_gig_harbor_hs', id FROM "OrganisationMember" WHERE "userId" = 51 AND "organisationId" = 'org_psd401district';
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_ghhs_elliottj', 'org_group_sped_gig_harbor_hs', id FROM "OrganisationMember" WHERE "userId" = 43 AND "organisationId" = 'org_psd401district';
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_ghhs_upchurchm', 'org_group_sped_gig_harbor_hs', id FROM "OrganisationMember" WHERE "userId" = 63 AND "organisationId" = 'org_psd401district';

  -- Henderson Bay HS: floresd(92), upchurchm(63), elliottj(43)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_hbhs_floresd', 'org_group_sped_henderson_bay_hs', id FROM "OrganisationMember" WHERE "userId" = 92 AND "organisationId" = 'org_psd401district';
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_hbhs_upchurchm', 'org_group_sped_henderson_bay_hs', id FROM "OrganisationMember" WHERE "userId" = 63 AND "organisationId" = 'org_psd401district';
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_hbhs_elliottj', 'org_group_sped_henderson_bay_hs', id FROM "OrganisationMember" WHERE "userId" = 43 AND "organisationId" = 'org_psd401district';

  -- Peninsula HS: christensenc(29), cremar(27), walshd(72), upchurchm(63)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_phs_christensenc', 'org_group_sped_peninsula_hs', id FROM "OrganisationMember" WHERE "userId" = 29 AND "organisationId" = 'org_psd401district';
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_phs_cremar', 'org_group_sped_peninsula_hs', id FROM "OrganisationMember" WHERE "userId" = 27 AND "organisationId" = 'org_psd401district';
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_phs_walshd', 'org_group_sped_peninsula_hs', id FROM "OrganisationMember" WHERE "userId" = 72 AND "organisationId" = 'org_psd401district';

  -- CTP: morrisonc(46)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_ctp_morrisonc', 'org_group_sped_ctp', id FROM "OrganisationMember" WHERE "userId" = 46 AND "organisationId" = 'org_psd401district';

  -- Voyager: hiemstral(60)
  INSERT INTO "OrganisationGroupMember" (id, "groupId", "organisationMemberId")
  SELECT 'gm_sped_voy_hiemstral', 'org_group_sped_voyager', id FROM "OrganisationMember" WHERE "userId" = 60 AND "organisationId" = 'org_psd401district';

END $$;

COMMIT;
