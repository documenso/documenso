import { hashString } from '@documenso/lib/server-only/auth/hash';
import { createOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';
import { createTeam } from '@documenso/lib/server-only/team/create-team';
import { onCreateUserHook } from '@documenso/lib/server-only/user/create-user';

import { INTERNAL_CLAIM_ID, internalClaims } from '@documenso/lib/types/subscription';
import { alphaid } from '@documenso/lib/universal/id';
import { env } from '@documenso/lib/utils/env';
import { prisma } from '@documenso/prisma';
import { OrganisationType } from '@prisma/client';
import crypto from 'crypto';
import { Hono } from 'hono';

import type { HonoEnv } from '../../router';

export const bootstrapRoute = new Hono<HonoEnv>();

/**
 * POST /api/bootstrap
 *
 * Protected by X-Bootstrap-Secret header.
 * Creates or finds user, org, team, and returns a fresh API token.
 */
bootstrapRoute.post('/bootstrap', async (c) => {
  const secret = env('BOOTSTRAP_SECRET');

  if (!secret) {
    return c.json({ success: false, error: 'Bootstrap not configured' }, 500);
  }

  const headerSecret = c.req.header('X-Bootstrap-Secret') ?? '';

  // Timing-safe comparison
  const secretBuffer = Buffer.from(secret, 'utf-8');
  const headerBuffer = Buffer.from(headerSecret, 'utf-8');

  if (secretBuffer.length !== headerBuffer.length || !crypto.timingSafeEqual(secretBuffer, headerBuffer)) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json<{
    teamIdentifier: string;
    teamName: string;
    adminEmail: string;
    adminName: string;
    webhookUrl?: string;
    webhookSecret?: string;
  }>();

  if (!body.teamIdentifier || !body.adminEmail) {
    return c.json({ success: false, error: 'Missing required fields' }, 400);
  }

  const normalizedEmail = body.adminEmail.toLowerCase();

  try {
    // 1. Find or create user
    let user = await prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: body.adminName || 'fixOS Service',
          emailVerified: new Date(),
          // No password — API token only, cannot log into UI
        },
      });

      await onCreateUserHook(user, { skipPersonalOrganisation: true }).catch((err) => {
        console.error('onCreateUserHook error during bootstrap:', err);
      });
    }

    // 2. Find or create organisation by URL = teamIdentifier
    let organisation = await prisma.organisation.findFirst({
      where: { url: body.teamIdentifier },
    });

    if (!organisation) {
      organisation = await createOrganisation({
        userId: user.id,
        name: body.teamName || body.teamIdentifier,
        type: OrganisationType.ORGANISATION,
        url: body.teamIdentifier,
        claim: internalClaims[INTERNAL_CLAIM_ID.ENTERPRISE],
      });
    }

    // 3. Find or create team by URL = teamIdentifier in that org
    let team = await prisma.team.findFirst({
      where: {
        url: body.teamIdentifier,
        organisationId: organisation.id,
      },
    });

    if (!team) {
      await createTeam({
        userId: user.id,
        teamName: body.teamName || body.teamIdentifier,
        teamUrl: body.teamIdentifier,
        organisationId: organisation.id,
        inheritMembers: true,
      });

      team = await prisma.team.findFirst({
        where: {
          url: body.teamIdentifier,
          organisationId: organisation.id,
        },
      });
    }

    if (!team) {
      return c.json({ success: false, error: 'Failed to create team' }, 500);
    }

    // 4. Create fresh API token (always new, old tokens remain valid)
    const rawToken = `api_${alphaid(16)}`;
    const hashedToken = hashString(rawToken);

    await prisma.apiToken.create({
      data: {
        name: `fixos-bootstrap-${Date.now()}`,
        token: hashedToken,
        userId: user.id,
        teamId: team.id,
        expires: null,
      },
    });

    // 5. Create or update webhook if URL provided
    if (body.webhookUrl) {
      const existingWebhook = await prisma.webhook.findFirst({
        where: {
          teamId: team.id,
          webhookUrl: body.webhookUrl,
        },
      });

      if (existingWebhook) {
        await prisma.webhook.update({
          where: { id: existingWebhook.id },
          data: {
            enabled: true,
            secret: body.webhookSecret || existingWebhook.secret,
            eventTriggers: ['DOCUMENT_OPENED', 'DOCUMENT_SIGNED', 'DOCUMENT_COMPLETED'],
          },
        });
      } else {
        await prisma.webhook.create({
          data: {
            webhookUrl: body.webhookUrl,
            eventTriggers: ['DOCUMENT_OPENED', 'DOCUMENT_SIGNED', 'DOCUMENT_COMPLETED'],
            secret: body.webhookSecret || null,
            enabled: true,
            userId: user.id,
            teamId: team.id,
          },
        });
      }
    }

    return c.json({
      success: true,
      teamId: team.id,
      teamUrl: team.url,
      organisationId: organisation.id,
      apiToken: rawToken,
      userId: user.id,
    });
  } catch (error) {
    console.error('Bootstrap error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Bootstrap failed',
      },
      500,
    );
  }
});
