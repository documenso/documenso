import { updateSubscriptionItemQuantity } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { TeamLeaveEmailTemplate } from '@documenso/email/templates/team-leave';
import { IS_BILLING_ENABLED, WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { TeamMemberRole } from '@documenso/prisma/client';

export type LeaveTeamOptions = {
  /**
   * The ID of the user who is leaving the team.
   */
  userId: number;

  /**
   * The ID of the team the user is leaving.
   */
  teamId: number;
};

export const leaveTeam = async ({ userId, teamId }: LeaveTeamOptions) => {
  await prisma.$transaction(
    async (tx) => {
      const team = await tx.team.findFirstOrThrow({
        where: {
          id: teamId,
          ownerUserId: {
            not: userId,
          },
        },
        include: {
          subscription: true,
          members: {
            include: {
              user: true,
            },
          },
        },
      });

      const leavingUser = await tx.user.findUniqueOrThrow({
        where: { id: userId },
      });

      await tx.teamMember.delete({
        where: {
          userId_teamId: {
            userId,
            teamId,
          },
          team: {
            ownerUserId: {
              not: userId,
            },
          },
        },
      });

      if (IS_BILLING_ENABLED() && team.subscription) {
        const numberOfSeats = await tx.teamMember.count({
          where: {
            teamId,
          },
        });

        await updateSubscriptionItemQuantity({
          priceId: team.subscription.priceId,
          subscriptionId: team.subscription.planId,
          quantity: numberOfSeats,
        });
      }

      const teamAdminAndManagers = team.members.filter(
        (member) => member.role === TeamMemberRole.ADMIN || member.role === TeamMemberRole.MANAGER,
      );

      for (const recipient of teamAdminAndManagers) {
        const emailContent = TeamLeaveEmailTemplate({
          assetBaseUrl: WEBAPP_BASE_URL,
          baseUrl: WEBAPP_BASE_URL,
          memberName: leavingUser.name ?? '',
          memberEmail: leavingUser.email,
          teamName: team.name,
          teamUrl: team.url,
        });

        await mailer.sendMail({
          to: recipient.user.email,
          from: 'noreply@documenso.com',
          subject: `A team member has left ${team.name}`,
          html: render(emailContent),
          text: render(emailContent, { plainText: true }),
        });
      }
    },
    { timeout: 30_000 },
  );
};
