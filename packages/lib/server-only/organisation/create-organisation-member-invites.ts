import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import type { Organisation, Prisma } from '@prisma/client';
import { OrganisationMemberInviteStatus } from '@prisma/client';
import { nanoid } from 'nanoid';

import { syncMemberCountWithStripeSeatPlan } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { mailer } from '@documenso/email/mailer';
import { OrganisationInviteEmailTemplate } from '@documenso/email/templates/organisation-invite';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { isOrganisationRoleWithinUserHierarchy } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';
import type { TCreateOrganisationMemberInvitesRequestSchema } from '@documenso/trpc/server/organisation-router/create-organisation-member-invites.types';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { validateIfSubscriptionIsRequired } from '../../utils/billing';
import { buildOrganisationWhereQuery } from '../../utils/organisations';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { getEmailContext } from '../email/get-email-context';
import { getMemberOrganisationRole } from '../team/get-member-roles';

export type CreateOrganisationMemberInvitesOptions = {
  userId: number;
  userName: string;
  organisationId: string;
  invitations: TCreateOrganisationMemberInvitesRequestSchema['invitations'];
};

/**
 * Invite organisation members via email to join a organisation.
 */
export const createOrganisationMemberInvites = async ({
  userId,
  userName,
  organisationId,
  invitations,
}: CreateOrganisationMemberInvitesOptions): Promise<void> => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery(
      organisationId,
      userId,
      ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    ),
    include: {
      members: {
        select: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
      invites: {
        where: {
          status: OrganisationMemberInviteStatus.PENDING,
        },
      },
      organisationGlobalSettings: true,
      organisationClaim: true,
      subscription: true,
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const { organisationClaim } = organisation;

  const subscription = validateIfSubscriptionIsRequired(organisation.subscription);

  const currentOrganisationMemberRole = await getMemberOrganisationRole({
    organisationId: organisation.id,
    reference: {
      type: 'User',
      id: userId,
    },
  });

  const organisationMemberEmails = organisation.members.map((member) => member.user.email);
  const organisationMemberInviteEmails = organisation.invites.map((invite) => invite.email);

  const usersToInvite = invitations.filter((invitation) => {
    // Filter out users that are already members of the organisation.
    if (organisationMemberEmails.includes(invitation.email)) {
      return false;
    }

    // Filter out users that have already been invited to the organisation.
    if (organisationMemberInviteEmails.includes(invitation.email)) {
      return false;
    }

    return true;
  });

  const unauthorizedRoleAccess = usersToInvite.some(
    ({ organisationRole }) =>
      !isOrganisationRoleWithinUserHierarchy(currentOrganisationMemberRole, organisationRole),
  );

  if (unauthorizedRoleAccess) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'User does not have permission to set high level roles',
    });
  }

  const organisationMemberInvites: Prisma.OrganisationMemberInviteCreateManyInput[] =
    usersToInvite.map(({ email, organisationRole }) => ({
      email,
      organisationId,
      organisationRole,
      token: nanoid(32),
    }));

  const numberOfCurrentMembers = organisation.members.length;
  const numberOfCurrentInvites = organisation.invites.length;
  const numberOfNewInvites = organisationMemberInvites.length;

  const totalMemberCountWithInvites =
    numberOfCurrentMembers + numberOfCurrentInvites + numberOfNewInvites;

  // Handle billing for seat based plans.
  if (subscription) {
    await syncMemberCountWithStripeSeatPlan(
      subscription,
      organisationClaim,
      totalMemberCountWithInvites,
    );
  }

  await prisma.organisationMemberInvite.createMany({
    data: organisationMemberInvites,
  });

  const sendEmailResult = await Promise.allSettled(
    organisationMemberInvites.map(async ({ email, token }) =>
      sendOrganisationMemberInviteEmail({
        email,
        token,
        organisation,
        senderName: userName,
      }),
    ),
  );

  const sendEmailResultErrorList = sendEmailResult.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );

  if (sendEmailResultErrorList.length > 0) {
    console.error(JSON.stringify(sendEmailResultErrorList));

    throw new AppError('EmailDeliveryFailed', {
      message: 'Failed to send invite emails to one or more users.',
      userMessage: `Failed to send invites to ${sendEmailResultErrorList.length}/${organisationMemberInvites.length} users.`,
    });
  }
};

type SendOrganisationMemberInviteEmailOptions = {
  email: string;
  senderName: string;
  token: string;
  organisation: Pick<Organisation, 'id' | 'name'>;
};

/**
 * Send an email to a user inviting them to join a organisation.
 */
export const sendOrganisationMemberInviteEmail = async ({
  email,
  senderName,
  token,
  organisation,
}: SendOrganisationMemberInviteEmailOptions) => {
  const template = createElement(OrganisationInviteEmailTemplate, {
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    baseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    senderName,
    token,
    organisationName: organisation.name,
  });

  const { branding, settings } = await getEmailContext({
    source: {
      type: 'organisation',
      organisationId: organisation.id,
    },
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template, {
      lang: settings.documentLanguage,
      branding,
    }),
    renderEmailWithI18N(template, {
      lang: settings.documentLanguage,
      branding,
      plainText: true,
    }),
  ]);

  const i18n = await getI18nInstance(settings.documentLanguage);

  await mailer.sendMail({
    to: email,
    from: {
      name: FROM_NAME,
      address: FROM_ADDRESS,
    },
    subject: i18n._(msg`You have been invited to join ${organisation.name} on Documenso`),
    html,
    text,
  });
};
