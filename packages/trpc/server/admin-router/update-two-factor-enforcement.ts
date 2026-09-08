import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getInstanceTwoFactorEnforcementConfig } from '@documenso/lib/server-only/2fa/get-instance-two-factor-enforcement-config';
import { SITE_SETTINGS_TWO_FACTOR_ENFORCEMENT_ID } from '@documenso/lib/server-only/site-settings/schemas/two-factor-enforcement';
import { upsertSiteSetting } from '@documenso/lib/server-only/site-settings/upsert-site-setting';
import { evaluateInstanceTwoFactorEnforcementUpdate } from '@documenso/lib/utils/two-factor';
import type { Session } from '@prisma/client';

import { adminProcedure } from '../trpc';
import {
  ZUpdateTwoFactorEnforcementRequestSchema,
  ZUpdateTwoFactorEnforcementResponseSchema,
} from './update-two-factor-enforcement.types';

/**
 * Dedicated write route for the `site.two-factor-enforcement` setting. The
 * generic `admin.updateSiteSetting` deliberately excludes this setting from
 * its write union — this route carries the license assert, the enable-time
 * guard and the grace-reduction acknowledgement.
 *
 * The full policy decision (license gate incl. the unlicensed disable-only
 * exception, enable-time guard, grace-reduction acknowledgement, server-side
 * `enforcedFrom` reset on off→on) lives in the pure
 * `evaluateInstanceTwoFactorEnforcementUpdate` helper so it is unit-testable.
 *
 * 2FA enforcement metadata: inherits `'none'` from the admin base — admin
 * procedures carry no organisation scope, while the INSTANCE assert still
 * applies via `adminMiddleware`.
 */
export const updateTwoFactorEnforcementRoute = adminProcedure
  .input(ZUpdateTwoFactorEnforcementRequestSchema)
  .output(ZUpdateTwoFactorEnforcementResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { enabled, gracePeriodDays, acknowledgeGracePeriodReduction } = input;

    // Explicitly asserted local, mirroring `update-organisation-settings`:
    // avoids control-flow narrowing differences between workspace tsconfigs.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const requestSession = ctx.session as Pick<Session, 'twoFactorVerified'> | null;

    ctx.logger.info({
      input: {
        enabled,
        gracePeriodDays,
      },
    });

    const storedConfig = await getInstanceTwoFactorEnforcementConfig();

    const decision = evaluateInstanceTwoFactorEnforcementUpdate({
      stored: {
        enabled: storedConfig.enabled,
        gracePeriodDays: storedConfig.gracePeriodDays,
        enforcedFrom: storedConfig.enforcedFrom,
      },
      update: {
        enabled,
        gracePeriodDays,
        acknowledgeGracePeriodReduction,
      },
      isLicensed: storedConfig.isLicensed,
      actor: {
        userTwoFactorEnabled: ctx.user.twoFactorEnabled,
        sessionTwoFactorVerified: requestSession?.twoFactorVerified ?? false,
      },
      now: new Date(),
    });

    if (!decision.allowed) {
      switch (decision.reason) {
        case 'UNLICENSED':
          throw new AppError(AppErrorCode.FORBIDDEN, {
            message:
              'Your license does not include instance-wide two-factor enforcement. Without the license the only permitted change is disabling the currently stored configuration.',
            statusCode: 403,
          });

        case 'ENABLE_REQUIRES_ACTOR_TWO_FACTOR':
          throw new AppError(AppErrorCode.TWO_FACTOR_REQUIRED, {
            message:
              'You must have two-factor authentication enabled and verified on this session before requiring it for the instance.',
            statusCode: 403,
          });

        case 'GRACE_REDUCTION_NOT_ACKNOWLEDGED':
          throw new AppError(AppErrorCode.INVALID_REQUEST, {
            message:
              'This change reduces the active two-factor authentication grace period and must be explicitly acknowledged.',
          });
      }
    }

    await upsertSiteSetting({
      id: SITE_SETTINGS_TWO_FACTOR_ENFORCEMENT_ID,
      enabled: decision.next.enabled,
      data: {
        gracePeriodDays: decision.next.gracePeriodDays,
        enforcedFrom: decision.next.enforcedFrom,
      },
      userId: ctx.user.id,
    });
  });
