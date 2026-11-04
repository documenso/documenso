const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type IsTwoFactorSatisfiedOptions = {
  userTwoFactorEnabled: boolean;
  sessionTwoFactorVerified: boolean;
};

export const isTwoFactorSatisfied = (options: IsTwoFactorSatisfiedOptions): boolean => {
  const { userTwoFactorEnabled, sessionTwoFactorVerified } = options;

  return userTwoFactorEnabled && sessionTwoFactorVerified;
};

export type CalculateTwoFactorDeadlineOptions = {
  anchors: Array<Date | null | undefined>;
  gracePeriodDays: number;
};

export const calculateTwoFactorDeadline = (options: CalculateTwoFactorDeadlineOptions): Date | null => {
  const { anchors, gracePeriodDays } = options;

  const anchorTimes = anchors
    .filter((anchor): anchor is Date => anchor instanceof Date)
    .map((anchor) => anchor.getTime());

  if (anchorTimes.length === 0) {
    return null;
  }

  const latestAnchorTime = Math.max(...anchorTimes);

  return new Date(latestAnchorTime + gracePeriodDays * MILLISECONDS_PER_DAY);
};

export type IsTwoFactorDeadlineExpiredOptions = {
  deadline: Date;
  now: Date;
};

export const isTwoFactorDeadlineExpired = (options: IsTwoFactorDeadlineExpiredOptions): boolean => {
  const { deadline, now } = options;

  return now.getTime() >= deadline.getTime();
};

// Longer `setTimeout` delays overflow the signed 32-bit timer and fire
// immediately.
export const MAX_TWO_FACTOR_DEADLINE_TIMER_DELAY_MS = 2 ** 31 - 1;

export type CalculateTwoFactorDeadlineTimerDelayOptions = {
  deadline: Date;
  now: Date;
};

/**
 * Returns `null` when the deadline is further away than `setTimeout` can
 * represent, in which case no timer should be scheduled.
 */
export const calculateTwoFactorDeadlineTimerDelay = (
  options: CalculateTwoFactorDeadlineTimerDelayOptions,
): number | null => {
  const { deadline, now } = options;

  const delay = deadline.getTime() - now.getTime();

  if (delay <= 0) {
    return 0;
  }

  if (delay > MAX_TWO_FACTOR_DEADLINE_TIMER_DELAY_MS) {
    return null;
  }

  return delay;
};

export type TwoFactorGraceWindow = {
  anchors: Array<Date | null | undefined>;
  gracePeriodDays: number;
};

export type IsTwoFactorGracePeriodReductionOptions = {
  previous: TwoFactorGraceWindow | null;
  next: TwoFactorGraceWindow | null;

  now: Date;
};

/**
 * Only true when an unexpired deadline moves earlier. Enabling for the first
 * time, disabling, or tightening an already-expired window are not reductions.
 */
export const isTwoFactorGracePeriodReduction = (options: IsTwoFactorGracePeriodReductionOptions): boolean => {
  const { previous, next, now } = options;

  const previousDeadline = previous ? calculateTwoFactorDeadline(previous) : null;
  const nextDeadline = next ? calculateTwoFactorDeadline(next) : null;

  if (!previousDeadline || !nextDeadline) {
    return false;
  }

  const isPreviousGraceActive = !isTwoFactorDeadlineExpired({ deadline: previousDeadline, now });

  return isPreviousGraceActive && nextDeadline.getTime() < previousDeadline.getTime();
};

export type TTwoFactorEnforcementStatus =
  | { required: false }
  | {
      required: true;
      deadline: Date;
      isDeadlineExpired: boolean;
      isSatisfied: boolean;
      isBlocked: boolean;
    };

export type ComputeTwoFactorEnforcementStatusOptions = {
  graceWindow: TwoFactorGraceWindow | null;
  userTwoFactorEnabled: boolean;
  sessionTwoFactorVerified: boolean;

  now: Date;
};

export const computeTwoFactorEnforcementStatus = (
  options: ComputeTwoFactorEnforcementStatusOptions,
): TTwoFactorEnforcementStatus => {
  const { graceWindow, userTwoFactorEnabled, sessionTwoFactorVerified, now } = options;

  if (!graceWindow) {
    return { required: false };
  }

  const deadline = calculateTwoFactorDeadline(graceWindow);

  if (!deadline) {
    return { required: false };
  }

  const isSatisfied = isTwoFactorSatisfied({ userTwoFactorEnabled, sessionTwoFactorVerified });
  const isDeadlineExpired = isTwoFactorDeadlineExpired({ deadline, now });

  return {
    required: true,
    deadline,
    isDeadlineExpired,
    isSatisfied,
    isBlocked: isDeadlineExpired && !isSatisfied,
  };
};

export type OrganisationTwoFactorEnforcementSettings = {
  twoFactorRequired: boolean;
  twoFactorGracePeriodDays: number;
  twoFactorEnforcedFrom: Date | null;
};

export type ComputeOrganisationTwoFactorEnforcementStatusOptions = {
  organisationSettings: OrganisationTwoFactorEnforcementSettings;
  memberCreatedAt: Date;
  userTwoFactorEnabled: boolean;
  userTwoFactorGraceStartedAt: Date;
  sessionTwoFactorVerified: boolean;

  now: Date;
};

/**
 * Joining is never blocked, the grace window starts at join. An admin 2FA reset
 * restarts it via `userTwoFactorGraceStartedAt`.
 */
export const computeOrganisationTwoFactorEnforcementStatus = (
  options: ComputeOrganisationTwoFactorEnforcementStatusOptions,
): TTwoFactorEnforcementStatus => {
  const {
    organisationSettings,
    memberCreatedAt,
    userTwoFactorEnabled,
    userTwoFactorGraceStartedAt,
    sessionTwoFactorVerified,
    now,
  } = options;

  return computeTwoFactorEnforcementStatus({
    graceWindow: organisationSettings.twoFactorRequired
      ? {
          anchors: [memberCreatedAt, organisationSettings.twoFactorEnforcedFrom, userTwoFactorGraceStartedAt],
          gracePeriodDays: organisationSettings.twoFactorGracePeriodDays,
        }
      : null,
    userTwoFactorEnabled,
    sessionTwoFactorVerified,
    now,
  });
};

export type InstanceTwoFactorEnforcementStoredConfig = {
  enabled: boolean;
  gracePeriodDays: number;
  enforcedFrom: string | null;
};

export type EvaluateInstanceTwoFactorEnforcementUpdateOptions = {
  stored: InstanceTwoFactorEnforcementStoredConfig;

  update: {
    enabled: boolean;
    gracePeriodDays: number;
    acknowledgeGracePeriodReduction?: boolean;
  };
  isLicensed: boolean;
  actor: IsTwoFactorSatisfiedOptions;

  now: Date;
};

export type InstanceTwoFactorEnforcementUpdateDecision =
  | {
      allowed: true;

      next: InstanceTwoFactorEnforcementStoredConfig;
    }
  | {
      allowed: false;
      reason: 'UNLICENSED' | 'ENABLE_REQUIRES_ACTOR_TWO_FACTOR' | 'GRACE_REDUCTION_NOT_ACKNOWLEDGED';
    };

/**
 * - The only unlicensed update allowed is disabling with all other values
 *   unchanged, so a lapsed license can always turn the policy off.
 * - Enabling requires the actor to already satisfy the policy. Prevents
 *   self-lockout (a 0-day grace would instantly block the actor from the very
 *   settings route that undoes it) and removes the instant-DoS lever.
 */
export const evaluateInstanceTwoFactorEnforcementUpdate = (
  options: EvaluateInstanceTwoFactorEnforcementUpdateOptions,
): InstanceTwoFactorEnforcementUpdateDecision => {
  const { stored, update, isLicensed, actor, now } = options;

  const isEnabling = update.enabled && !stored.enabled;

  if (!isLicensed) {
    const isDisableOnly = stored.enabled && !update.enabled && update.gracePeriodDays === stored.gracePeriodDays;

    if (!isDisableOnly) {
      return { allowed: false, reason: 'UNLICENSED' };
    }
  }

  if (isEnabling && !isTwoFactorSatisfied(actor)) {
    return { allowed: false, reason: 'ENABLE_REQUIRES_ACTOR_TWO_FACTOR' };
  }

  const nextEnforcedFrom = isEnabling ? now.toISOString() : stored.enforcedFrom;

  const isGraceReduction = isTwoFactorGracePeriodReduction({
    previous: stored.enabled
      ? {
          anchors: [stored.enforcedFrom ? new Date(stored.enforcedFrom) : null],
          gracePeriodDays: stored.gracePeriodDays,
        }
      : null,
    next: update.enabled
      ? {
          anchors: [nextEnforcedFrom ? new Date(nextEnforcedFrom) : null],
          gracePeriodDays: update.gracePeriodDays,
        }
      : null,
    now,
  });

  if (isGraceReduction && update.acknowledgeGracePeriodReduction !== true) {
    return { allowed: false, reason: 'GRACE_REDUCTION_NOT_ACKNOWLEDGED' };
  }

  return {
    allowed: true,
    next: {
      enabled: update.enabled,
      gracePeriodDays: update.gracePeriodDays,
      enforcedFrom: nextEnforcedFrom,
    },
  };
};

export type IsInstanceTwoFactorEnforcementActiveOptions = {
  setting: { enabled: boolean } | null;
  isLicensed: boolean;
};

// A manually inserted row on an unlicensed instance is a silent noop.
export const isInstanceTwoFactorEnforcementActive = (options: IsInstanceTwoFactorEnforcementActiveOptions): boolean => {
  const { setting, isLicensed } = options;

  return Boolean(setting?.enabled) && isLicensed;
};
