import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { streamText } from 'hono/streaming';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { IS_AI_FEATURES_CONFIGURED } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { detectFieldsFromEnvelope } from '@documenso/lib/server-only/ai/envelope/detect-fields';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';

import type { HonoEnv } from '../../router';
import { ZDetectFieldsRequestSchema } from './detect-fields.types';

const KEEPALIVE_INTERVAL_MS = 5000;

export const detectFieldsRoute = new Hono<HonoEnv>().post(
  '/',
  sValidator('json', ZDetectFieldsRequestSchema),
  async (c) => {
    const logger = c.get('logger');

    try {
      const { envelopeId, teamId, context } = c.req.valid('json');

      const session = await getSession(c);

      if (!session.user) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'You must be logged in to detect fields',
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
        event: 'ai.detect-fields.start',
        envelopeId,
        userId: session.user.id,
        teamId: team.id,
        hasContext: !!context,
      });

      // Return streaming response with NDJSON
      return streamText(c, async (stream) => {
        // Start keepalive to prevent connection timeout
        let interval: NodeJS.Timeout | null = setInterval(() => {
          void stream.writeln(JSON.stringify({ type: 'keepalive' }));
        }, KEEPALIVE_INTERVAL_MS);

        try {
          const allFields = await detectFieldsFromEnvelope({
            context,
            envelopeId,
            userId: session.user.id,
            teamId: team.id,
            onProgress: (progress) => {
              void stream.writeln(
                JSON.stringify({
                  type: 'progress',
                  pagesProcessed: progress.pagesProcessed,
                  totalPages: progress.totalPages,
                  fieldsDetected: progress.fieldsDetected,
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
            event: 'ai.detect-fields.complete',
            envelopeId,
            userId: session.user.id,
            teamId: team.id,
            fieldCount: allFields.length,
          });

          await stream.writeln(
            JSON.stringify({
              type: 'complete',
              fields: allFields,
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
            event: 'ai.detect-fields.error',
            error,
          });

          const message = error instanceof AppError ? error.message : 'Failed to detect fields';

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
        event: 'ai.detect-fields.error',
        error,
      });

      if (error instanceof AppError) {
        const { status, body } = AppError.toRestAPIError(error);

        return c.json(body, status);
      }

      return c.json({ error: 'Failed to detect fields' }, 500);
    }
  },
);
