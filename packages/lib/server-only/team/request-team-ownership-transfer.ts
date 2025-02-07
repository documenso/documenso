import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import { TeamTransferRequestTemplate } from '@documenso/email/templates/team-transfer-request';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { createTokenVerification } from '@documenso/lib/utils/token-verification';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';

export type RequestTeamOwnershipTransferOptions = {
  /**
   * The ID of the user initiating the transfer.
   */
  userId: number;

  /**
   * The name of the user initiating the transfer.
   */
  userName: string;

  /**
   * The ID of the team whose ownership is being transferred.
   */
  teamId: number;

  /**
   * The user ID of the new owner.
   */
  newOwnerUserId: number;

  /**
   * Whether to clear any current payment methods attached to the team.
   */
  clearPaymentMethods: boolean;
};

export const requestTeamOwnershipTransfer = async ({
  userId,
  userName,
  teamId,
  newOwnerUserId,
}: RequestTeamOwnershipTransferOptions): Promise<void> => {
  // Todo: Clear payment methods disabled for now.
  const clearPaymentMethods = false;

  await prisma.$transaction(
    async (tx) => {
      const team = await tx.team.findFirstOrThrow({
        where: {
          id: teamId,
          ownerUserId: userId,
          members: {
            some: {
              userId: newOwnerUserId,
            },
          },
        },
      });

      const newOwnerUser = await tx.user.findFirstOrThrow({
        where: {
          id: newOwnerUserId,
        },
      });

      const { token, expiresAt } = createTokenVerification({ minute: 10 });

      const teamVerificationPayload = {
        teamId,
        token,
        expiresAt,
        userId: newOwnerUserId,
        name: newOwnerUser.name ?? '',
        email: newOwnerUser.email,
        clearPaymentMethods,
      };

      await tx.teamTransferVerification.upsert({
        where: {
          teamId,
        },
        create: teamVerificationPayload,
        update: teamVerificationPayload,
      });

      const template = createElement(TeamTransferRequestTemplate, {
        assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
        baseUrl: NEXT_PUBLIC_WEBAPP_URL(),
        senderName: userName,
        teamName: team.name,
        teamUrl: team.url,
        token,
      });

      const [html, text] = await Promise.all([
        renderEmailWithI18N(template),
        renderEmailWithI18N(template, { plainText: true }),
      ]);

      const i18n = await getI18nInstance();

      await mailer.sendMail({
        to: newOwnerUser.email,
        from: {
          name: FROM_NAME,
          address: FROM_ADDRESS,
        },
        subject: i18n._(
          msg`You have been requested to take ownership of team ${team.name} on Documenso`,
        ),
        html,
        text,
      });
    },
    { timeout: 30_000 },
  );
};
