import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { sendOrganisationMemberInviteEmail } from '@documenso/lib/server-only/organisation/create-organisation-member-invites';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZResendOrganisationMemberInviteRequestSchema,
  ZResendOrganisationMemberInviteResponseSchema,
} from './resend-organisation-member-invite.types';

export const resendOrganisationMemberInviteRoute = authenticatedProcedure
  //   .meta(resendOrganisationMemberInviteMeta)
  .input(ZResendOrganisationMemberInviteRequestSchema)
  .output(ZResendOrganisationMemberInviteResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { organisationId, invitationId } = input;

    const userId = ctx.user.id;
    const userName = ctx.user.name || '';

    await resendOrganisationMemberInvitation({
      userId,
      userName,
      organisationId,
      invitationId,
    });
  });

export type ResendOrganisationMemberInvitationOptions = {
  /**
   * The ID of the user who is initiating this action.
   */
  userId: number;

  /**
   * The name of the user who is initiating this action.
   */
  userName: string;

  /**
   * The ID of the organisation.
   */
  organisationId: string;

  /**
   * The IDs of the invitations to resend.
   */
  invitationId: string;
};

/**
 * Resend an email for a given member invite.
 */
export const resendOrganisationMemberInvitation = async ({
  userId,
  userName,
  organisationId,
  invitationId,
}: ResendOrganisationMemberInvitationOptions): Promise<void> => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery(
      organisationId,
      userId,
      ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    ),
    include: {
      organisationGlobalSettings: true,
      invites: {
        where: {
          id: invitationId,
        },
      },
    },
  });

  if (!organisation) {
    throw new AppError('OrganisationNotFound', {
      message: 'User is not a valid member of the team.',
      statusCode: 404,
    });
  }

  const invitation = organisation.invites[0];

  if (!invitation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Invitation does not exist',
    });
  }

  await sendOrganisationMemberInviteEmail({
    email: invitation.email,
    token: invitation.token,
    senderName: userName,
    organisation,
  });
};
