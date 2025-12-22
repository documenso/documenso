import { Prisma, WebhookCallStatus, WebhookTriggerEvents } from '@prisma/client';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { FindResultResponse } from '@documenso/lib/types/search-params';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZResendWebhookCallRequestSchema,
  ZResendWebhookCallResponseSchema,
} from './resend-webhook-call.types';

export const resendWebhookCallRoute = authenticatedProcedure
  .input(ZResendWebhookCallRequestSchema)
  .output(ZResendWebhookCallResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { webhookId, webhookCallId } = input;

    ctx.logger.info({
      input: { webhookId, webhookCallId },
    });

    const webhookCall = await prisma.webhookCall.findFirst({
      where: {
        id: webhookCallId,
        webhook: {
          id: webhookId,
          team: buildTeamWhereQuery({
            teamId,
            userId: user.id,
            roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP.MANAGE_TEAM,
          }),
        },
      },
      include: {
        webhook: true,
      },
    });

    if (!webhookCall) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    const { webhook } = webhookCall;

    // Note: This is duplicated in `execute-webhook.handler.ts`.
    const response = await fetch(webhookCall.url, {
      method: 'POST',
      body: JSON.stringify(webhookCall.requestBody),
      headers: {
        'Content-Type': 'application/json',
        'X-Documenso-Secret': webhook.secret ?? '',
      },
    });

    const body = await response.text();

    let responseBody: Prisma.InputJsonValue | Prisma.JsonNullValueInput = Prisma.JsonNull;

    try {
      responseBody = JSON.parse(body);
    } catch (err) {
      responseBody = body;
    }

    return await prisma.webhookCall.update({
      where: {
        id: webhookCall.id,
      },
      data: {
        status: response.ok ? WebhookCallStatus.SUCCESS : WebhookCallStatus.FAILED,
        responseCode: response.status,
        responseBody,
        responseHeaders: Object.fromEntries(response.headers.entries()),
      },
    });
  });
