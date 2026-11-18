import { updateUser } from '@documenso/lib/server-only/admin/update-user';
import { acceptOrganisationInvitation } from '@documenso/lib/server-only/organisation/accept-organisation-invitation';
import { findUserByProvidedEmail } from '@documenso/lib/server-only/user/find-user-by-provided-email';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { OrganisationMemberRole } from '@prisma/client';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('1234567890abcdef', 10);

/**
 * Mirrors what SSO left behind before emails were normalised: a mixed-case account sharing
 * its address with a lowercase account.
 */
const seedCaseVariantUsers = async () => {
  const mixedCaseEmail = `Jane.${nanoid()}@Test.Documenso.com`;

  const mixedCaseUser = await prisma.user.create({
    data: {
      email: mixedCaseEmail,
    },
  });

  const { user: lowercaseUser } = await seedUser({ email: mixedCaseEmail.toLowerCase() });

  return { lowercaseUser, mixedCaseUser, mixedCaseEmail };
};

test('[USER][EMAIL_CASING]: provided casing resolves to its own account, other casings to the lowercase account', async () => {
  const { lowercaseUser, mixedCaseUser, mixedCaseEmail } = await seedCaseVariantUsers();

  const userForProvidedCasing = await findUserByProvidedEmail({ email: mixedCaseEmail });
  const userForOtherCasing = await findUserByProvidedEmail({ email: mixedCaseEmail.toUpperCase() });
  const userForLowercase = await findUserByProvidedEmail({ email: mixedCaseEmail.toLowerCase() });

  expect(userForProvidedCasing?.id).toBe(mixedCaseUser.id);
  expect(userForOtherCasing?.id).toBe(lowercaseUser.id);
  expect(userForLowercase?.id).toBe(lowercaseUser.id);
});

test('[USER][EMAIL_CASING]: organisation invite is accepted by the lowercase account, not its mixed-case twin', async () => {
  const { lowercaseUser, mixedCaseUser } = await seedCaseVariantUsers();
  const { organisation } = await seedUser();

  const invite = await prisma.organisationMemberInvite.create({
    data: {
      id: generateDatabaseId('member_invite'),
      email: lowercaseUser.email,
      organisationId: organisation.id,
      organisationRole: OrganisationMemberRole.MEMBER,
      token: nanoid(),
    },
  });

  await acceptOrganisationInvitation({ token: invite.token });

  const members = await prisma.organisationMember.findMany({
    where: {
      organisationId: organisation.id,
      userId: {
        in: [lowercaseUser.id, mixedCaseUser.id],
      },
    },
  });

  expect(members.map((member) => member.userId)).toEqual([lowercaseUser.id]);
});

test('[USER][EMAIL_CASING]: admin can edit a mixed-case account that has a lowercase twin', async () => {
  const { mixedCaseUser, mixedCaseEmail } = await seedCaseVariantUsers();

  await updateUser({
    id: mixedCaseUser.id,
    name: 'Renamed User',
    email: mixedCaseEmail,
    roles: undefined,
  });

  const updatedUser = await prisma.user.findUniqueOrThrow({
    where: {
      id: mixedCaseUser.id,
    },
  });

  expect(updatedUser.name).toBe('Renamed User');
  expect(updatedUser.email).toBe(mixedCaseEmail);
});

test('[USER][EMAIL_CASING]: admin email change is stored lowercase', async () => {
  const { user } = await seedUser();

  const newEmail = `New.${nanoid()}@Test.Documenso.com`;

  await updateUser({
    id: user.id,
    name: undefined,
    email: newEmail,
    roles: undefined,
  });

  const updatedUser = await prisma.user.findUniqueOrThrow({
    where: {
      id: user.id,
    },
  });

  expect(updatedUser.email).toBe(newEmail.toLowerCase());
});
