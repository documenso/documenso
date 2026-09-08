/**
 * Pure 2FA enforcement policy helpers.
 *
 * Everything in this file must remain free of I/O so the enforcement policy
 * can be unit tested directly.
 */

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type IsTwoFactorSatisfiedOptions = {
  userTwoFactorEnabled: boolean;
  sessionTwoFactorVerified: boolean;
};

/**
 * Whether a user + session pair satisfies 2FA enforcement.
 *
 * The user must have 2FA enrolled AND the current session must have passed a
 * second factor (TOTP/backup challenge, UV passkey sign-in, or enabling 2FA
 * mid-session).
 */
export const isTwoFactorSatisfied = (options: IsTwoFactorSatisfiedOptions): boolean => {
  const { userTwoFactorEnabled, sessionTwoFactorVerified } = options;

  return userTwoFactorEnabled && sessionTwoFactorVerified;
};

export type CalculateTwoFactorDeadlineOptions = {
  /**
   * Anchor dates for the grace window. Null/undefined entries are ignored,
   * the latest remaining anchor wins.
   */
  anchors: Array<Date | null | undefined>;

  /**
   * Number of grace days after the latest anchor. 0 means the deadline is the
   * anchor instant itself (immediate enforcement).
   */
  gracePeriodDays: number;
};

/**
 * Shared deadline calculation for both instance and organisation enforcement:
 * `max(anchors) + gracePeriodDays`.
 *
 * Returns `null` when no anchor is provided.
 */
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

/**
 * Whether a deadline has expired. The deadline instant itself counts as
 * expired (`now >= deadline`).
 */
export const isTwoFactorDeadlineExpired = (options: IsTwoFactorDeadlineExpiredOptions): boolean => {
  const { deadline, now } = options;

  return now.getTime() >= deadline.getTime();
};

/**
 * The maximum delay `setTimeout` reliably supports (2^31 - 1 ms, ~24.8 days).
 * Longer delays overflow the signed 32-bit timer and fire immediately.
 */
export const MAX_TWO_FACTOR_DEADLINE_TIMER_DELAY_MS = 2 ** 31 - 1;

export type CalculateTwoFactorDeadlineTimerDelayOptions = {
  deadline: Date;
  now: Date;
};

/**
 * Milliseconds until a 2FA enforcement deadline, for scheduling a client-side
 * timer that navigates to enrolment the instant the grace window closes.
 *
 * Returns:
 * - `0` when the deadline is already reached/past (fire immediately),
 * - the positive delay when it fits within the `setTimeout` range,
 * - `null` when the deadline is further away than `setTimeout` can represent —
 *   no timer should be scheduled (a later navigation/session refresh will
 *   re-evaluate long before ~24.8 days elapse).
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
  /**
   * The currently stored grace window, or null when enforcement is not
   * currently configured.
   */
  previous: TwoFactorGraceWindow | null;

  /**
   * The proposed grace window, or null when the update disables enforcement.
   */
  next: TwoFactorGraceWindow | null;

  now: Date;
};

/**
 * Whether a settings update reduces an *active* grace window.
 *
 * Only true when the previous configuration produced a deadline that has not
 * yet expired and the new configuration moves that deadline earlier. Enabling
 * enforcement for the first time, disabling it, or tightening an
 * already-expired window are not reductions.
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

/**
 * Shared 2FA enforcement status shape, used by both instance and organisation
 * enforcement.
 *
 * `isBlocked` is computed server-side once (`isDeadlineExpired && !isSatisfied`)
 * — consumers branch only on `isBlocked`; the deadline fields exist for
 * banners/copy.
 *
 * This type lives here (not in server-only code) so client code such as the
 * session provider can import it.
 */
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
  /**
   * The grace window derived from the applicable enforcement policy, or null
   * when enforcement is not configured/active.
   */
  graceWindow: TwoFactorGraceWindow | null;

  userTwoFactorEnabled: boolean;

  /**
   * Whether the current session passed a second factor. Contexts without a
   * session (e.g. API access) never count as verified.
   */
  sessionTwoFactorVerified: boolean;

  now: Date;
};

/**
 * Pure derivation of the 2FA enforcement status for a user + session against
 * a grace window.
 *
 * Server-only getters wrap this with the I/O needed to load the policy; the
 * policy math itself stays unit-testable.
 */
export const computeTwoFactorEnforcementStatus = (
  options: ComputeTwoFactorEnforcementStatusOptions,
): TTwoFactorEnforcementStatus => {
  const { graceWindow, userTwoFactorEnabled, sessionTwoFactorVerified, now } = options;

  if (!graceWindow) {
    return { required: false };
  }

  const deadline = calculateTwoFactorDeadline(graceWindow);

  // Defensive: a window without any anchor has no enforceable deadline.
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
  /**
   * The organisation's global settings 2FA fields.
   */
  organisationSettings: OrganisationTwoFactorEnforcementSettings;

  /**
   * When the user joined the organisation. Joining is never blocked — the
   * grace window starts at join.
   */
  memberCreatedAt: Date;

  userTwoFactorEnabled: boolean;

  /**
   * Restarted by an admin 2FA reset, which restarts organisation grace too.
   */
  userTwoFactorGraceStartedAt: Date;

  /**
   * Whether the current session passed a second factor. Contexts without a
   * session (e.g. API access) never count as verified — machine access is
   * exempt from enforcement anyway, this only keeps the shape honest.
   */
  sessionTwoFactorVerified: boolean;

  now: Date;
};

/**
 * Pure derivation of the per-organisation 2FA enforcement status for a
 * member + session.
 *
 * Deadline: `max(member.createdAt, orgSettings.twoFactorEnforcedFrom,
 * user.twoFactorGraceStartedAt) + orgSettings.twoFactorGracePeriodDays`.
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

  /**
   * ISO datetime string, or null when enforcement was never enabled. Kept as
   * a string to match the stored `site.two-factor-enforcement` row shape.
   */
  enforcedFrom: string | null;
};

export type EvaluateInstanceTwoFactorEnforcementUpdateOptions = {
  /**
   * The currently stored configuration (schema defaults when the row is
   * absent or malformed).
   */
  stored: InstanceTwoFactorEnforcementStoredConfig;

  update: {
    enabled: boolean;
    gracePeriodDays: number;
    acknowledgeGracePeriodReduction?: boolean;
  };

  /**
   * Whether the instance license grants `instanceTwoFactorEnforcement`.
   */
  isLicensed: boolean;

  /**
   * The acting admin's own 2FA state, used for the enable-time guard.
   */
  actor: IsTwoFactorSatisfiedOptions;

  now: Date;
};

export type InstanceTwoFactorEnforcementUpdateDecision =
  | {
      allowed: true;

      /**
       * The configuration to persist. `enforcedFrom` is reset to `now` on an
       * off→on transition and preserved otherwise.
       */
      next: InstanceTwoFactorEnforcementStoredConfig;
    }
  | {
      allowed: false;
      reason: 'UNLICENSED' | 'ENABLE_REQUIRES_ACTOR_TWO_FACTOR' | 'GRACE_REDUCTION_NOT_ACKNOWLEDGED';
    };

/**
 * Pure policy decision for updating the instance-wide 2FA enforcement
 * setting. The `admin.updateTwoFactorEnforcement` route delegates to this so
 * the entire decision is unit-testable without I/O.
 *
 * Rules, in evaluation order:
 *
 * 1. License gate: enabling — or changing any value while enabled — requires
 *    the license flag. The ONLY unlicensed update allowed is disable-only: an
 *    enabled→disabled transition with all other values unchanged from the
 *    stored row (so an instance whose license lapsed can always turn the
 *    policy off, but not tweak it).
 * 2. Enable-time guard: an off→on transition requires the acting admin to
 *    already satisfy the policy being enabled (2FA enrolled AND second factor
 *    verified on this session). Prevents self-lockout — a 0-day grace would
 *    instantly block the actor from the very settings route that undoes it —
 *    and removes the instant-DoS lever.
 * 3. Grace-reduction acknowledgement: shortening an active grace window
 *    requires an explicit `acknowledgeGracePeriodReduction: true`.
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
  /**
   * The parsed `site.two-factor-enforcement` setting row, or null when the
   * row is missing or fails to parse.
   */
  setting: { enabled: boolean } | null;

  /**
   * Whether the instance license grants the `instanceTwoFactorEnforcement`
   * flag.
   */
  isLicensed: boolean;
};

/**
 * Activation decision for instance-wide 2FA enforcement.
 *
 * A manually inserted row on an unlicensed instance is a silent noop.
 */
export const isInstanceTwoFactorEnforcementActive = (options: IsInstanceTwoFactorEnforcementActiveOptions): boolean => {
  const { setting, isLicensed } = options;

  return Boolean(setting?.enabled) && isLicensed;
};
