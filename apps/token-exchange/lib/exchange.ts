import slugify from '@sindresorhus/slugify';

import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { createTeam } from '@documenso/lib/server-only/team/create-team';
import { prisma } from '@documenso/prisma';

import { validateThirdPartyCredentials } from './validate-credentials';

export type ExchangeInput = {
  credentials: Record<string, unknown>;
  slug: string;
  organisationId: string;
};

export type ExchangeResult =
  | { success: true; teamId: number; apiKey: string; teamCreated: boolean }
  | { success: false; error: string; code: string };

export async function exchangeCredentials({
  credentials,
  slug,
  organisationId,
}: ExchangeInput): Promise<ExchangeResult> {
  const isValid = await validateThirdPartyCredentials(credentials);

  if (!isValid) {
    return {
      success: false,
      error: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS',
    };
  }

  const teamUrl = slugify(slug, { lowercase: true });

  if (!teamUrl) {
    return {
      success: false,
      error: 'Invalid slug',
      code: 'INVALID_SLUG',
    };
  }

  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { id: true, ownerUserId: true },
  });

  if (!organisation) {
    return {
      success: false,
      error: 'Organisation not found',
      code: 'ORGANISATION_NOT_FOUND',
    };
  }

  let team = await prisma.team.findFirst({
    where: {
      url: teamUrl,
      organisationId,
    },
  });

  let teamCreated = false;

  if (!team) {
    try {
      await createTeam({
        userId: organisation.ownerUserId,
        teamName: slug,
        teamUrl,
        organisationId,
        inheritMembers: true,
      });
    } catch (err) {
      // Prisma unique constraint violation
      const hasP2002 =
        err &&
        typeof err === 'object' &&
        'code' in err &&
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        (err as { code?: unknown }).code === 'P2002';

      if (hasP2002) {
        return {
          success: false,
          error: 'Team URL already exists in another organisation',
          code: 'TEAM_URL_TAKEN',
        };
      }

      throw err;
    }

    team = await prisma.team.findFirst({
      where: {
        url: teamUrl,
        organisationId,
      },
    });

    if (!team) {
      return {
        success: false,
        error: 'Failed to create team',
        code: 'TEAM_CREATION_FAILED',
      };
    }

    teamCreated = true;
  }

  const tokenName = `Token Exchange - ${new Date().toISOString().slice(0, 10)}`;

  const { token } = await createApiToken({
    userId: organisation.ownerUserId,
    teamId: team.id,
    tokenName,
    expiresIn: null,
  });

  return {
    success: true,
    teamId: team.id,
    apiKey: token,
    teamCreated,
  };
}
