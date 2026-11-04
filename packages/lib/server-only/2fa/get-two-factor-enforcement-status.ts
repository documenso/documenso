import type { Session, User } from '@prisma/client';

import type { TTwoFactorEnforcementStatus } from '../../utils/two-factor';
import { computeTwoFactorEnforcementStatus } from '../../utils/two-factor';
import { getInstanceTwoFactorEnforcementSetting } from './get-instance-two-factor-enforcement-setting';

export type GetTwoFactorEnforcementStatusOptions = {
  user: Pick<User, 'twoFactorEnabled' | 'twoFactorGraceStartedAt'>;
  session: Pick<Session, 'twoFactorVerified'> | null;
};

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
