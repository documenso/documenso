import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { generateDatabaseId, nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedOrganisationMembers } from '@documenso/prisma/seed/organisations';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';
import { OrganisationGroupType, type OrganisationMemberRole } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

/**
 * Calls a tRPC mutation directly using the cookies of whoever is currently
 * signed in on the page context. This deliberately bypasses the UI: the
 * authorisation checks under test live on the server, and the UI may simply
 * hide a button rather than reject the request, which would mask a backend gap.
 */
const trpcMutation = async (page: Page, procedure: string, input: Record<string, unknown>) => {
  return await page.request.post(`${WEBAPP_BASE_URL}/api/trpc/${procedure}`, {
    headers: { 'content-type': 'application/json' },
    data: JSON.stringify({ json: input }),
  });
};

const getOrganisationMember = async (userId: number, organisationId: string) => {
  return await prisma.organisationMember.findFirstOrThrow({
    where: {
      userId,
      organisationId,
    },
  });
};

const createCustomGroup = async (organisationId: string, organisationRole: OrganisationMemberRole) => {
  return await prisma.organisationGroup.create({
    data: {
      id: generateDatabaseId('org_group'),
      organisationId,
      name: `custom-${organisationRole}-${nanoid()}`,
      type: OrganisationGroupType.CUSTOM,
      organisationRole,
    },
  });
};

const createPendingInvite = async (organisationId: string, organisationRole: OrganisationMemberRole) => {
  return await prisma.organisationMemberInvite.create({
    data: {
      id: generateDatabaseId('member_invite'),
      email: `invite-${nanoid()}@test.documenso.com`,
      token: nanoid(32),
      organisationId,
      organisationRole,
    },
  });
};

test.describe('[ORGANISATION_PERMISSION_HIERARCHY]: member deletion', () => {
  test('a manager cannot delete an admin via member.delete', async ({ page }) => {
    const { organisation } = await seedUser({ isPersonalOrganisation: false });

    const [managerUser, adminUser] = await seedOrganisationMembers({
      members: [
        { name: 'Manager', organisationRole: 'MANAGER' },
        { name: 'Admin', organisationRole: 'ADMIN' },
      ],
      organisationId: organisation.id,
    });

    const adminMember = await getOrganisationMember(adminUser.id, organisation.id);

    await apiSignin({ page, email: managerUser.email });

    const res = await trpcMutation(page, 'organisation.member.delete', {
      organisationId: organisation.id,
      organisationMemberId: adminMember.id,
    });

    expect(res.ok()).toBeFalsy();

    // The admin must still be a member of the organisation.
    const stillExists = await prisma.organisationMember.findFirst({
      where: { id: adminMember.id },
    });

    expect(stillExists).not.toBeNull();
  });

  test('a manager cannot delete an admin via member.deleteMany', async ({ page }) => {
    const { organisation } = await seedUser({ isPersonalOrganisation: false });

    const [managerUser, adminUser] = await seedOrganisationMembers({
      members: [
        { name: 'Manager', organisationRole: 'MANAGER' },
        { name: 'Admin', organisationRole: 'ADMIN' },
      ],
      organisationId: organisation.id,
    });

    const adminMember = await getOrganisationMember(adminUser.id, organisation.id);

    await apiSignin({ page, email: managerUser.email });

    const res = await trpcMutation(page, 'organisation.member.deleteMany', {
      organisationId: organisation.id,
      organisationMemberIds: [adminMember.id],
    });

    expect(res.ok()).toBeFalsy();

    const stillExists = await prisma.organisationMember.findFirst({
      where: { id: adminMember.id },
    });

    expect(stillExists).not.toBeNull();
  });

  test('a manager cannot delete the organisation owner', async ({ page }) => {
    const { user: ownerUser, organisation } = await seedUser({ isPersonalOrganisation: false });

    const [managerUser] = await seedOrganisationMembers({
      members: [{ name: 'Manager', organisationRole: 'MANAGER' }],
      organisationId: organisation.id,
    });

    const ownerMember = await getOrganisationMember(ownerUser.id, organisation.id);

    await apiSignin({ page, email: managerUser.email });

    const res = await trpcMutation(page, 'organisation.member.deleteMany', {
      organisationId: organisation.id,
      organisationMemberIds: [ownerMember.id],
    });

    expect(res.ok()).toBeFalsy();

    const stillExists = await prisma.organisationMember.findFirst({
      where: { id: ownerMember.id },
    });

    expect(stillExists).not.toBeNull();
  });

  test('an admin cannot delete the organisation owner', async ({ page }) => {
    const { user: ownerUser, organisation } = await seedUser({ isPersonalOrganisation: false });

    const [adminUser] = await seedOrganisationMembers({
      members: [{ name: 'Admin', organisationRole: 'ADMIN' }],
      organisationId: organisation.id,
    });

    const ownerMember = await getOrganisationMember(ownerUser.id, organisation.id);

    await apiSignin({ page, email: adminUser.email });

    const res = await trpcMutation(page, 'organisation.member.deleteMany', {
      organisationId: organisation.id,
      organisationMemberIds: [ownerMember.id],
    });

    expect(res.ok()).toBeFalsy();

    const stillExists = await prisma.organisationMember.findFirst({
      where: { id: ownerMember.id },
    });

    expect(stillExists).not.toBeNull();
  });

  test('a manager can still delete a regular member (positive control)', async ({ page }) => {
    const { organisation } = await seedUser({ isPersonalOrganisation: false });

    const [managerUser, memberUser] = await seedOrganisationMembers({
      members: [
        { name: 'Manager', organisationRole: 'MANAGER' },
        { name: 'Member', organisationRole: 'MEMBER' },
      ],
      organisationId: organisation.id,
    });

    const member = await getOrganisationMember(memberUser.id, organisation.id);

    await apiSignin({ page, email: managerUser.email });

    const res = await trpcMutation(page, 'organisation.member.deleteMany', {
      organisationId: organisation.id,
      organisationMemberIds: [member.id],
    });

    expect(res.ok()).toBeTruthy();

    const deleted = await prisma.organisationMember.findFirst({
      where: { id: member.id },
    });

    expect(deleted).toBeNull();
  });
});

test.describe('[ORGANISATION_PERMISSION_HIERARCHY]: group deletion', () => {
  test('a manager cannot delete an admin-role group', async ({ page }) => {
    const { organisation } = await seedUser({ isPersonalOrganisation: false });

    const [managerUser] = await seedOrganisationMembers({
      members: [{ name: 'Manager', organisationRole: 'MANAGER' }],
      organisationId: organisation.id,
    });

    const adminGroup = await createCustomGroup(organisation.id, 'ADMIN');

    await apiSignin({ page, email: managerUser.email });

    const res = await trpcMutation(page, 'organisation.group.delete', {
      organisationId: organisation.id,
      groupId: adminGroup.id,
    });

    expect(res.ok()).toBeFalsy();

    const stillExists = await prisma.organisationGroup.findFirst({
      where: { id: adminGroup.id },
    });

    expect(stillExists).not.toBeNull();
  });

  test('a manager can delete a member-role group (positive control)', async ({ page }) => {
    const { organisation } = await seedUser({ isPersonalOrganisation: false });

    const [managerUser] = await seedOrganisationMembers({
      members: [{ name: 'Manager', organisationRole: 'MANAGER' }],
      organisationId: organisation.id,
    });

    const memberGroup = await createCustomGroup(organisation.id, 'MEMBER');

    await apiSignin({ page, email: managerUser.email });

    const res = await trpcMutation(page, 'organisation.group.delete', {
      organisationId: organisation.id,
      groupId: memberGroup.id,
    });

    expect(res.ok()).toBeTruthy();

    const deleted = await prisma.organisationGroup.findFirst({
      where: { id: memberGroup.id },
    });

    expect(deleted).toBeNull();
  });
});

test.describe('[ORGANISATION_PERMISSION_HIERARCHY]: invite resend', () => {
  test('a manager cannot resend an admin-role invite', async ({ page }) => {
    const { organisation } = await seedUser({ isPersonalOrganisation: false });

    const [managerUser] = await seedOrganisationMembers({
      members: [{ name: 'Manager', organisationRole: 'MANAGER' }],
      organisationId: organisation.id,
    });

    const adminInvite = await createPendingInvite(organisation.id, 'ADMIN');

    await apiSignin({ page, email: managerUser.email });

    const res = await trpcMutation(page, 'organisation.member.invite.resend', {
      organisationId: organisation.id,
      invitationId: adminInvite.id,
    });

    expect(res.ok()).toBeFalsy();
  });

  test('a manager can resend a member-role invite (positive control)', async ({ page }) => {
    const { organisation } = await seedUser({ isPersonalOrganisation: false });

    const [managerUser] = await seedOrganisationMembers({
      members: [{ name: 'Manager', organisationRole: 'MANAGER' }],
      organisationId: organisation.id,
    });

    const memberInvite = await createPendingInvite(organisation.id, 'MEMBER');

    await apiSignin({ page, email: managerUser.email });

    const res = await trpcMutation(page, 'organisation.member.invite.resend', {
      organisationId: organisation.id,
      invitationId: memberInvite.id,
    });

    expect(res.ok()).toBeTruthy();
  });
});

test.describe('[ORGANISATION_PERMISSION_HIERARCHY]: leaving an organisation', () => {
  test('the owner cannot leave without transferring ownership first', async ({ page }) => {
    const { user: ownerUser, organisation } = await seedUser({ isPersonalOrganisation: false });

    const ownerMember = await getOrganisationMember(ownerUser.id, organisation.id);

    await apiSignin({ page, email: ownerUser.email });

    const res = await trpcMutation(page, 'organisation.leave', {
      organisationId: organisation.id,
    });

    expect(res.ok()).toBeFalsy();

    const stillExists = await prisma.organisationMember.findFirst({
      where: { id: ownerMember.id },
    });

    expect(stillExists).not.toBeNull();
  });

  test('a non-owner member can still leave (positive control)', async ({ page }) => {
    const { organisation } = await seedUser({ isPersonalOrganisation: false });

    const [memberUser] = await seedOrganisationMembers({
      members: [{ name: 'Member', organisationRole: 'MEMBER' }],
      organisationId: organisation.id,
    });

    const member = await getOrganisationMember(memberUser.id, organisation.id);

    await apiSignin({ page, email: memberUser.email });

    const res = await trpcMutation(page, 'organisation.leave', {
      organisationId: organisation.id,
    });

    expect(res.ok()).toBeTruthy();

    const deleted = await prisma.organisationMember.findFirst({
      where: { id: member.id },
    });

    expect(deleted).toBeNull();
  });
});

test.describe('[ORGANISATION_PERMISSION_HIERARCHY]: group membership scoping', () => {
  test('cannot add a member from another organisation to a group', async ({ page }) => {
    // Organisation A, where the actor is the owner/admin.
    const { user: actor, organisation: organisationA } = await seedUser({
      isPersonalOrganisation: false,
    });

    // A separate organisation B with a member the actor has no authority over.
    const { organisation: organisationB } = await seedUser({ isPersonalOrganisation: false });
    const [foreignUser] = await seedOrganisationMembers({
      members: [{ name: 'Foreign', organisationRole: 'MEMBER' }],
      organisationId: organisationB.id,
    });

    const foreignMember = await getOrganisationMember(foreignUser.id, organisationB.id);

    // A custom group the actor legitimately controls in organisation A.
    const groupA = await createCustomGroup(organisationA.id, 'MEMBER');

    await apiSignin({ page, email: actor.email });

    const res = await trpcMutation(page, 'organisation.group.update', {
      id: groupA.id,
      memberIds: [foreignMember.id],
    });

    expect(res.ok()).toBeFalsy();

    const injectedMembership = await prisma.organisationGroupMember.findFirst({
      where: { groupId: groupA.id, organisationMemberId: foreignMember.id },
    });

    expect(injectedMembership).toBeNull();
  });

  test('can add a member from the same organisation to a group (positive control)', async ({ page }) => {
    const { user: actor, organisation } = await seedUser({ isPersonalOrganisation: false });

    const [memberUser] = await seedOrganisationMembers({
      members: [{ name: 'Member', organisationRole: 'MEMBER' }],
      organisationId: organisation.id,
    });

    const member = await getOrganisationMember(memberUser.id, organisation.id);

    const group = await createCustomGroup(organisation.id, 'MEMBER');

    await apiSignin({ page, email: actor.email });

    const res = await trpcMutation(page, 'organisation.group.update', {
      id: group.id,
      memberIds: [member.id],
    });

    expect(res.ok()).toBeTruthy();

    const membership = await prisma.organisationGroupMember.findFirst({
      where: { groupId: group.id, organisationMemberId: member.id },
    });

    expect(membership).not.toBeNull();
  });
});
