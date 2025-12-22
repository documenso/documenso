import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { streamText } from 'hono/streaming';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { IS_AI_FEATURES_CONFIGURED } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { detectRecipientsFromEnvelope } from '@documenso/lib/server-only/ai/envelope/detect-recipients';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';

import type { HonoEnv } from '../../router';
import { ZDetectRecipientsRequestSchema } from './detect-recipients.types';

const KEEPALIVE_INTERVAL_MS = 5000;

export const detectRecipientsRoute = new Hono<HonoEnv>().post(
  '/',
  sValidator('json', ZDetectRecipientsRequestSchema),
  async (c) => {
    const logger = c.get('logger');

    try {
      const { envelopeId, teamId } = c.req.valid('json');

      const session = await getSession(c);

      if (!session.user) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'You must be logged in to detect recipients',
        });
      }

      // Verify user has access to the team (abort early)
      const team = await getTeamById({
        userId: session.user.id,
        teamId,
      }).catch(() => null);

      if (!team) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'You do not have access to this team',
        });
      }

      // Check if AI features are enabled for the team
      const { aiFeaturesEnabled } = team.derivedSettings;

      if (!aiFeaturesEnabled) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'AI features are not enabled for this team',
        });
      }

      if (!IS_AI_FEATURES_CONFIGURED()) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'AI features are not configured. Please contact support to enable AI features.',
        });
      }

      logger.info({
        event: 'ai.detect-recipients.start',
        envelopeId,
        userId: session.user.id,
        teamId: team.id,
      });

      // Return streaming response with NDJSON
      return streamText(c, async (stream) => {
        // Start keepalive to prevent connection timeout
        let interval: NodeJS.Timeout | null = setInterval(() => {
          void stream.writeln(JSON.stringify({ type: 'keepalive' }));
        }, KEEPALIVE_INTERVAL_MS);

        try {
          const recipients = await detectRecipientsFromEnvelope({
            envelopeId,
            userId: session.user.id,
            teamId: team.id,
            onProgress: (progress) => {
              void stream.writeln(
                JSON.stringify({
                  type: 'progress',
                  pagesProcessed: progress.pagesProcessed,
                  totalPages: progress.totalPages,
                  recipientsDetected: progress.recipientsDetected,
                }),
              );
            },
          });

          // Clear keepalive before sending final response
          if (interval) {
            clearInterval(interval);
            interval = null;
          }

          logger.info({
            event: 'ai.detect-recipients.complete',
            envelopeId,
            userId: session.user.id,
            teamId: team.id,
            recipientCount: recipients.length,
          });

          await stream.writeln(
            JSON.stringify({
              type: 'complete',
              recipients,
            }),
          );
        } catch (error) {
          // Clear keepalive on error
          if (interval) {
            clearInterval(interval);
          }

          // The logger below it stringifies the error, using `console.error`
          // to attempt to get a stack trace
          console.error(error);

          logger.error({
            event: 'ai.detect-recipients.error',
            error,
          });

          const message = error instanceof AppError ? error.message : 'Failed to detect recipients';

          await stream.writeln(
            JSON.stringify({
              type: 'error',
              message,
            }),
          );
        }
      });
    } catch (error) {
      // Handle errors that occur before streaming starts
      logger.error({
        event: 'ai.detect-recipients.error',
        error,
      });

      if (error instanceof AppError) {
        const { status, body } = AppError.toRestAPIError(error);

        return c.json(body, status);
      }

      return c.json({ error: 'Failed to detect recipients' }, 500);
    }
  },
);
