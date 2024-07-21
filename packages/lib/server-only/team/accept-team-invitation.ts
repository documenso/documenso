import { updateSubscriptionItemQuantity } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { TeamJoinEmailTemplate } from '@documenso/email/templates/team-join';
import { IS_BILLING_ENABLED, WEBAPP_BASE_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { TeamMemberRole } from '@documenso/prisma/client';

export type AcceptTeamInvitationOptions = {
  userId: number;
  teamId: number;
};

export const acceptTeamInvitation = async ({ userId, teamId }: AcceptTeamInvitationOptions) => {
  await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findFirstOrThrow({
        where: {
          id: userId,
        },
      });

      const teamMemberInvite = await tx.teamMemberInvite.findFirstOrThrow({
        where: {
          teamId,
          email: user.email,
        },
        include: {
          team: {
            include: {
              subscription: true,
              members: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });

      const { team } = teamMemberInvite;

      await tx.teamMember.create({
        data: {
          teamId: teamMemberInvite.teamId,
          userId: user.id,
          role: teamMemberInvite.role,
        },
      });

      await tx.teamMemberInvite.delete({
        where: {
          id: teamMemberInvite.id,
        },
      });

      if (IS_BILLING_ENABLED() && team.subscription) {
        const numberOfSeats = await tx.teamMember.count({
          where: {
            teamId: teamMemberInvite.teamId,
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

      for (const admin of teamAdminAndManagers) {
        const emailContent = TeamJoinEmailTemplate({
          assetBaseUrl: WEBAPP_BASE_URL,
          baseUrl: WEBAPP_BASE_URL,
          memberName: user.name || '',
          memberEmail: user.email,
          teamName: team.name,
          teamUrl: team.url,
        });

        await mailer.sendMail({
          to: admin.user.email,
          from: 'noreply@documenso.com',
          subject: 'A new member has joined your team',
          html: render(emailContent),
          text: render(emailContent, { plainText: true }),
        });
      }
    },
    { timeout: 30_000 },
  );
};
