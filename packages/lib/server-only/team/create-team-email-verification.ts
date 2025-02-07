import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import type { Team, TeamGlobalSettings } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { mailer } from '@documenso/email/mailer';
import { ConfirmTeamEmailTemplate } from '@documenso/email/templates/confirm-team-email';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createTokenVerification } from '@documenso/lib/utils/token-verification';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { env } from '../../utils/env';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { teamGlobalSettingsToBranding } from '../../utils/team-global-settings-to-branding';

export type CreateTeamEmailVerificationOptions = {
  userId: number;
  teamId: number;
  data: {
    email: string;
    name: string;
  };
};

export const createTeamEmailVerification = async ({
  userId,
  teamId,
  data,
}: CreateTeamEmailVerificationOptions): Promise<void> => {
  try {
    await prisma.$transaction(
      async (tx) => {
        const team = await tx.team.findFirstOrThrow({
          where: {
            id: teamId,
            members: {
              some: {
                userId,
                role: {
                  in: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
                },
              },
            },
          },
          include: {
            teamEmail: true,
            emailVerification: true,
            teamGlobalSettings: true,
          },
        });

        if (team.teamEmail || team.emailVerification) {
          throw new AppError(AppErrorCode.INVALID_REQUEST, {
            message: 'Team already has an email or existing email verification.',
          });
        }

        const existingTeamEmail = await tx.teamEmail.findFirst({
          where: {
            email: data.email,
          },
        });

        if (existingTeamEmail) {
          throw new AppError(AppErrorCode.ALREADY_EXISTS, {
            message: 'Email already taken by another team.',
          });
        }

        const { token, expiresAt } = createTokenVerification({ hours: 1 });

        await tx.teamEmailVerification.create({
          data: {
            token,
            expiresAt,
            email: data.email,
            name: data.name,
            teamId,
          },
        });

        await sendTeamEmailVerificationEmail(data.email, token, team);
      },
      { timeout: 30_000 },
    );
  } catch (err) {
    console.error(err);

    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
      throw err;
    }

    const target = z.array(z.string()).safeParse(err.meta?.target);

    if (err.code === 'P2002' && target.success && target.data.includes('email')) {
      throw new AppError(AppErrorCode.ALREADY_EXISTS, {
        message: 'Email already taken by another team.',
      });
    }

    throw err;
  }
};

/**
 * Send an email to a user asking them to accept a team email request.
 *
 * @param email The email address to use for the team.
 * @param token The token used to authenticate that the user has granted access.
 * @param teamName The name of the team the user is being invited to.
 * @param teamUrl The url of the team the user is being invited to.
 */
export const sendTeamEmailVerificationEmail = async (
  email: string,
  token: string,
  team: Team & {
    teamGlobalSettings?: TeamGlobalSettings | null;
  },
) => {
  const assetBaseUrl = env('NEXT_PUBLIC_WEBAPP_URL') || 'http://localhost:3000';

  const template = createElement(ConfirmTeamEmailTemplate, {
    assetBaseUrl,
    baseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    teamName: team.name,
    teamUrl: team.url,
    token,
  });

  const branding = team.teamGlobalSettings
    ? teamGlobalSettingsToBranding(team.teamGlobalSettings)
    : undefined;

  const lang = team.teamGlobalSettings?.documentLanguage;

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template, { lang, branding }),
    renderEmailWithI18N(template, {
      lang,
      branding,
      plainText: true,
    }),
  ]);

  const i18n = await getI18nInstance(lang);

  await mailer.sendMail({
    to: email,
    from: {
      name: FROM_NAME,
      address: FROM_ADDRESS,
    },
    subject: i18n._(
      msg`A request to use your email has been initiated by ${team.name} on Documenso`,
    ),
    html,
    text,
  });
};
