import type { Session, User } from '@prisma/client';

import type { TTwoFactorEnforcementStatus } from '../../utils/two-factor';
import { computeTwoFactorEnforcementStatus } from '../../utils/two-factor';
import { getInstanceTwoFactorEnforcementSetting } from './get-instance-two-factor-enforcement-setting';

export type GetTwoFactorEnforcementStatusOptions = {
  /**
   * The user to evaluate. Callers that already hold the user row pass the
   * fields in directly — no redundant query is made here.
   */
  user: Pick<User, 'twoFactorEnabled' | 'twoFactorGraceStartedAt'>;

  /**
   * The current session, or null for contexts that carry no session (e.g.
   * API access), which never count as verified.
   */
  session: Pick<Session, 'twoFactorVerified'> | null;
};

/**
 * Instance-wide 2FA enforcement status for a user + session.
 *
 * Thin I/O wrapper around the pure `computeTwoFactorEnforcementStatus`:
 * loads the instance setting (null unless configured + licensed) and derives
 * the deadline from `max(user.twoFactorGraceStartedAt, setting.enforcedFrom)
 * + setting.gracePeriodDays`.
 *
 * `isBlocked` is computed here once — consumers branch only on it; deadline
 * fields are for banners.
 */
export const getTwoFactorEnforcementStatus = async (
  options: GetTwoFactorEnforcementStatusOptions,
): Promise<TTwoFactorEnforcementStatus> => {
  const { user, session } = options;

  const setting = await getInstanceTwoFactorEnforcementSetting();

  return computeTwoFactorEnforcementStatus({
    graceWindow: setting
      ? {
          anchors: [
            user.twoFactorGraceStartedAt,
            setting.data.enforcedFrom ? new Date(setting.data.enforcedFrom) : null,
          ],
          gracePeriodDays: setting.data.gracePeriodDays,
        }
      : null,
    userTwoFactorEnabled: user.twoFactorEnabled,
    sessionTwoFactorVerified: session?.twoFactorVerified ?? false,
    now: new Date(),
  });
};
