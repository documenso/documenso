import { describe, expect, it } from 'vitest';

import {
  calculateTwoFactorDeadline,
  calculateTwoFactorDeadlineTimerDelay,
  computeOrganisationTwoFactorEnforcementStatus,
  computeTwoFactorEnforcementStatus,
  evaluateInstanceTwoFactorEnforcementUpdate,
  isInstanceTwoFactorEnforcementActive,
  isTwoFactorDeadlineExpired,
  isTwoFactorGracePeriodReduction,
  isTwoFactorSatisfied,
  MAX_TWO_FACTOR_DEADLINE_TIMER_DELAY_MS,
} from './two-factor';

describe('isTwoFactorSatisfied', () => {
  it('is satisfied only when the user is enrolled and the session is verified', () => {
    expect(isTwoFactorSatisfied({ userTwoFactorEnabled: true, sessionTwoFactorVerified: true })).toBe(true);
  });

  it('is not satisfied when the session is unverified', () => {
    expect(isTwoFactorSatisfied({ userTwoFactorEnabled: true, sessionTwoFactorVerified: false })).toBe(false);
  });

  it('is not satisfied when the user is not enrolled', () => {
    expect(isTwoFactorSatisfied({ userTwoFactorEnabled: false, sessionTwoFactorVerified: true })).toBe(false);
    expect(isTwoFactorSatisfied({ userTwoFactorEnabled: false, sessionTwoFactorVerified: false })).toBe(false);
  });
});

describe('calculateTwoFactorDeadline', () => {
  it('adds the grace period to a single anchor', () => {
    const anchor = new Date('2026-01-01T00:00:00.000Z');

    const deadline = calculateTwoFactorDeadline({ anchors: [anchor], gracePeriodDays: 7 });

    expect(deadline).toEqual(new Date('2026-01-08T00:00:00.000Z'));
  });

  it('uses the latest anchor when multiple are provided', () => {
    const earlier = new Date('2026-01-01T00:00:00.000Z');
    const latest = new Date('2026-02-01T00:00:00.000Z');

    const deadline = calculateTwoFactorDeadline({
      anchors: [earlier, latest],
      gracePeriodDays: 1,
    });

    expect(deadline).toEqual(new Date('2026-02-02T00:00:00.000Z'));
  });

  it('ignores null and undefined anchors', () => {
    const anchor = new Date('2026-01-01T00:00:00.000Z');

    const deadline = calculateTwoFactorDeadline({
      anchors: [null, anchor, undefined],
      gracePeriodDays: 0,
    });

    expect(deadline).toEqual(anchor);
  });

  it('returns the anchor instant for a 0 day grace period', () => {
    const anchor = new Date('2026-01-01T12:34:56.000Z');

    const deadline = calculateTwoFactorDeadline({ anchors: [anchor], gracePeriodDays: 0 });

    expect(deadline).toEqual(anchor);
  });

  it('returns null when no anchors are provided', () => {
    expect(calculateTwoFactorDeadline({ anchors: [], gracePeriodDays: 7 })).toBeNull();
    expect(calculateTwoFactorDeadline({ anchors: [null, undefined], gracePeriodDays: 7 })).toBeNull();
  });
});

describe('isTwoFactorDeadlineExpired', () => {
  const deadline = new Date('2026-01-08T00:00:00.000Z');

  it('is not expired before the deadline', () => {
    const now = new Date('2026-01-07T23:59:59.999Z');

    expect(isTwoFactorDeadlineExpired({ deadline, now })).toBe(false);
  });

  it('counts the deadline instant itself as expired', () => {
    const now = new Date('2026-01-08T00:00:00.000Z');

    expect(isTwoFactorDeadlineExpired({ deadline, now })).toBe(true);
  });

  it('is expired after the deadline', () => {
    const now = new Date('2026-01-08T00:00:00.001Z');

    expect(isTwoFactorDeadlineExpired({ deadline, now })).toBe(true);
  });
});

describe('isTwoFactorGracePeriodReduction', () => {
  const anchor = new Date('2026-01-01T00:00:00.000Z');
  const now = new Date('2026-01-02T00:00:00.000Z');

  it('detects a reduced grace period while the previous grace is active', () => {
    expect(
      isTwoFactorGracePeriodReduction({
        previous: { anchors: [anchor], gracePeriodDays: 30 },
        next: { anchors: [anchor], gracePeriodDays: 7 },
        now,
      }),
    ).toBe(true);
  });

  it('detects a reduction caused by an earlier anchor set', () => {
    const laterEnforcedFrom = new Date('2026-01-10T00:00:00.000Z');

    expect(
      isTwoFactorGracePeriodReduction({
        previous: { anchors: [anchor, laterEnforcedFrom], gracePeriodDays: 7 },
        next: { anchors: [anchor], gracePeriodDays: 7 },
        now,
      }),
    ).toBe(true);
  });

  it('is not a reduction when the deadline stays the same', () => {
    expect(
      isTwoFactorGracePeriodReduction({
        previous: { anchors: [anchor], gracePeriodDays: 7 },
        next: { anchors: [anchor], gracePeriodDays: 7 },
        now,
      }),
    ).toBe(false);
  });

  it('is not a reduction when the deadline moves later', () => {
    expect(
      isTwoFactorGracePeriodReduction({
        previous: { anchors: [anchor], gracePeriodDays: 7 },
        next: { anchors: [anchor], gracePeriodDays: 30 },
        now,
      }),
    ).toBe(false);
  });

  it('is not a reduction when the previous grace has already expired', () => {
    const nowAfterExpiry = new Date('2026-03-01T00:00:00.000Z');

    expect(
      isTwoFactorGracePeriodReduction({
        previous: { anchors: [anchor], gracePeriodDays: 7 },
        next: { anchors: [anchor], gracePeriodDays: 0 },
        now: nowAfterExpiry,
      }),
    ).toBe(false);
  });

  it('is not a reduction when enforcement was not previously configured', () => {
    expect(
      isTwoFactorGracePeriodReduction({
        previous: null,
        next: { anchors: [anchor], gracePeriodDays: 0 },
        now,
      }),
    ).toBe(false);
  });

  it('is not a reduction when the update disables enforcement', () => {
    expect(
      isTwoFactorGracePeriodReduction({
        previous: { anchors: [anchor], gracePeriodDays: 7 },
        next: null,
        now,
      }),
    ).toBe(false);
  });
});

describe('computeTwoFactorEnforcementStatus', () => {
  const anchor = new Date('2026-01-01T00:00:00.000Z');
  const deadline = new Date('2026-01-08T00:00:00.000Z');

  const graceWindow = { anchors: [anchor], gracePeriodDays: 7 };

  it('is not required when no grace window is configured', () => {
    expect(
      computeTwoFactorEnforcementStatus({
        graceWindow: null,
        userTwoFactorEnabled: false,
        sessionTwoFactorVerified: false,
        now: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toEqual({ required: false });
  });

  it('is not required when the grace window has no anchors', () => {
    expect(
      computeTwoFactorEnforcementStatus({
        graceWindow: { anchors: [null, undefined], gracePeriodDays: 7 },
        userTwoFactorEnabled: false,
        sessionTwoFactorVerified: false,
        now: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toEqual({ required: false });
  });

  it('is required but not blocked within grace while unsatisfied', () => {
    expect(
      computeTwoFactorEnforcementStatus({
        graceWindow,
        userTwoFactorEnabled: false,
        sessionTwoFactorVerified: false,
        now: new Date('2026-01-02T00:00:00.000Z'),
      }),
    ).toEqual({
      required: true,
      deadline,
      isDeadlineExpired: false,
      isSatisfied: false,
      isBlocked: false,
    });
  });

  it('is required and satisfied within grace when enrolled and verified', () => {
    expect(
      computeTwoFactorEnforcementStatus({
        graceWindow,
        userTwoFactorEnabled: true,
        sessionTwoFactorVerified: true,
        now: new Date('2026-01-02T00:00:00.000Z'),
      }),
    ).toEqual({
      required: true,
      deadline,
      isDeadlineExpired: false,
      isSatisfied: true,
      isBlocked: false,
    });
  });

  it('blocks after the deadline while unsatisfied', () => {
    expect(
      computeTwoFactorEnforcementStatus({
        graceWindow,
        userTwoFactorEnabled: false,
        sessionTwoFactorVerified: false,
        now: new Date('2026-02-01T00:00:00.000Z'),
      }),
    ).toEqual({
      required: true,
      deadline,
      isDeadlineExpired: true,
      isSatisfied: false,
      isBlocked: true,
    });
  });

  it('does not block after the deadline when satisfied', () => {
    expect(
      computeTwoFactorEnforcementStatus({
        graceWindow,
        userTwoFactorEnabled: true,
        sessionTwoFactorVerified: true,
        now: new Date('2026-02-01T00:00:00.000Z'),
      }),
    ).toEqual({
      required: true,
      deadline,
      isDeadlineExpired: true,
      isSatisfied: true,
      isBlocked: false,
    });
  });

  it('does not block when enrolled but the session is unverified within grace', () => {
    const status = computeTwoFactorEnforcementStatus({
      graceWindow,
      userTwoFactorEnabled: true,
      sessionTwoFactorVerified: false,
      now: new Date('2026-01-02T00:00:00.000Z'),
    });

    expect(status).toMatchObject({ required: true, isSatisfied: false, isBlocked: false });
  });

  it('blocks an enrolled user with an unverified session after the deadline', () => {
    const status = computeTwoFactorEnforcementStatus({
      graceWindow,
      userTwoFactorEnabled: true,
      sessionTwoFactorVerified: false,
      now: new Date('2026-02-01T00:00:00.000Z'),
    });

    expect(status).toMatchObject({ required: true, isSatisfied: false, isBlocked: true });
  });

  it('counts the deadline instant itself as expired', () => {
    const status = computeTwoFactorEnforcementStatus({
      graceWindow,
      userTwoFactorEnabled: false,
      sessionTwoFactorVerified: false,
      now: deadline,
    });

    expect(status).toMatchObject({ required: true, isDeadlineExpired: true, isBlocked: true });
  });

  it('is not expired just before the deadline instant', () => {
    const status = computeTwoFactorEnforcementStatus({
      graceWindow,
      userTwoFactorEnabled: false,
      sessionTwoFactorVerified: false,
      now: new Date(deadline.getTime() - 1),
    });

    expect(status).toMatchObject({ required: true, isDeadlineExpired: false, isBlocked: false });
  });

  it('uses the latest anchor for the deadline', () => {
    const laterEnforcedFrom = new Date('2026-01-10T00:00:00.000Z');

    const status = computeTwoFactorEnforcementStatus({
      graceWindow: { anchors: [anchor, laterEnforcedFrom], gracePeriodDays: 7 },
      userTwoFactorEnabled: false,
      sessionTwoFactorVerified: false,
      now: new Date('2026-01-09T00:00:00.000Z'),
    });

    expect(status).toMatchObject({
      required: true,
      deadline: new Date('2026-01-17T00:00:00.000Z'),
      isDeadlineExpired: false,
    });
  });

  it('blocks immediately with a 0 day grace period', () => {
    const status = computeTwoFactorEnforcementStatus({
      graceWindow: { anchors: [anchor], gracePeriodDays: 0 },
      userTwoFactorEnabled: false,
      sessionTwoFactorVerified: false,
      now: anchor,
    });

    expect(status).toMatchObject({ required: true, deadline: anchor, isBlocked: true });
  });
});

describe('isInstanceTwoFactorEnforcementActive', () => {
  it('is active when the setting exists, is enabled and the license grants the flag', () => {
    expect(isInstanceTwoFactorEnforcementActive({ setting: { enabled: true }, isLicensed: true })).toBe(true);
  });

  it('is inactive when the setting row is missing', () => {
    expect(isInstanceTwoFactorEnforcementActive({ setting: null, isLicensed: true })).toBe(false);
  });

  it('is inactive when the setting is disabled', () => {
    expect(isInstanceTwoFactorEnforcementActive({ setting: { enabled: false }, isLicensed: true })).toBe(false);
  });

  it('is inactive on an unlicensed instance even when a row is enabled', () => {
    expect(isInstanceTwoFactorEnforcementActive({ setting: { enabled: true }, isLicensed: false })).toBe(false);
  });
});

describe('computeOrganisationTwoFactorEnforcementStatus', () => {
  const memberCreatedAt = new Date('2026-01-01T00:00:00.000Z');
  const graceStartedAt = new Date('2025-12-01T00:00:00.000Z');

  const baseOptions = {
    memberCreatedAt,
    userTwoFactorEnabled: false,
    userTwoFactorGraceStartedAt: graceStartedAt,
    sessionTwoFactorVerified: false,
  };

  it('is not required when the organisation does not require 2FA', () => {
    const status = computeOrganisationTwoFactorEnforcementStatus({
      ...baseOptions,
      organisationSettings: {
        twoFactorRequired: false,
        twoFactorGracePeriodDays: 7,
        twoFactorEnforcedFrom: new Date('2026-01-05T00:00:00.000Z'),
      },
      now: new Date('2026-12-01T00:00:00.000Z'),
    });

    expect(status).toEqual({ required: false });
  });

  it('derives the deadline from max(member.createdAt, enforcedFrom, graceStartedAt) + gracePeriodDays', () => {
    const enforcedFrom = new Date('2026-01-10T00:00:00.000Z');

    const status = computeOrganisationTwoFactorEnforcementStatus({
      ...baseOptions,
      organisationSettings: {
        twoFactorRequired: true,
        twoFactorGracePeriodDays: 7,
        twoFactorEnforcedFrom: enforcedFrom,
      },
      now: new Date('2026-01-12T00:00:00.000Z'),
    });

    expect(status).toMatchObject({
      required: true,
      deadline: new Date('2026-01-17T00:00:00.000Z'),
      isDeadlineExpired: false,
      isBlocked: false,
    });
  });

  it('anchors on member.createdAt when enforcedFrom is null and grace started earlier', () => {
    const status = computeOrganisationTwoFactorEnforcementStatus({
      ...baseOptions,
      organisationSettings: {
        twoFactorRequired: true,
        twoFactorGracePeriodDays: 7,
        twoFactorEnforcedFrom: null,
      },
      now: new Date('2026-01-08T00:00:00.000Z'),
    });

    expect(status).toMatchObject({
      required: true,
      deadline: new Date('2026-01-08T00:00:00.000Z'),
      isDeadlineExpired: true,
      isBlocked: true,
    });
  });

  it('an admin 2FA reset (later graceStartedAt) restarts the organisation grace window', () => {
    const restartedGraceStartedAt = new Date('2026-02-01T00:00:00.000Z');

    const status = computeOrganisationTwoFactorEnforcementStatus({
      ...baseOptions,
      userTwoFactorGraceStartedAt: restartedGraceStartedAt,
      organisationSettings: {
        twoFactorRequired: true,
        twoFactorGracePeriodDays: 7,
        twoFactorEnforcedFrom: null,
      },
      now: new Date('2026-02-02T00:00:00.000Z'),
    });

    expect(status).toMatchObject({
      required: true,
      deadline: new Date('2026-02-08T00:00:00.000Z'),
      isDeadlineExpired: false,
      isBlocked: false,
    });
  });

  it('is satisfied (never blocked) for an enrolled user with a verified session', () => {
    const status = computeOrganisationTwoFactorEnforcementStatus({
      ...baseOptions,
      userTwoFactorEnabled: true,
      sessionTwoFactorVerified: true,
      organisationSettings: {
        twoFactorRequired: true,
        twoFactorGracePeriodDays: 0,
        twoFactorEnforcedFrom: null,
      },
      now: new Date('2027-01-01T00:00:00.000Z'),
    });

    expect(status).toMatchObject({
      required: true,
      isSatisfied: true,
      isDeadlineExpired: true,
      isBlocked: false,
    });
  });

  it('an enrolled user with an unverified session (null/API context) is not satisfied', () => {
    const status = computeOrganisationTwoFactorEnforcementStatus({
      ...baseOptions,
      userTwoFactorEnabled: true,
      sessionTwoFactorVerified: false,
      organisationSettings: {
        twoFactorRequired: true,
        twoFactorGracePeriodDays: 0,
        twoFactorEnforcedFrom: null,
      },
      now: new Date('2027-01-01T00:00:00.000Z'),
    });

    expect(status).toMatchObject({
      required: true,
      isSatisfied: false,
      isBlocked: true,
    });
  });

  it('blocks organisation access immediately with a 0 day grace period', () => {
    const status = computeOrganisationTwoFactorEnforcementStatus({
      ...baseOptions,
      organisationSettings: {
        twoFactorRequired: true,
        twoFactorGracePeriodDays: 0,
        twoFactorEnforcedFrom: null,
      },
      now: memberCreatedAt,
    });

    expect(status).toMatchObject({ required: true, deadline: memberCreatedAt, isBlocked: true });
  });
});

describe('evaluateInstanceTwoFactorEnforcementUpdate', () => {
  const now = new Date('2026-06-01T00:00:00.000Z');

  const satisfiedActor = { userTwoFactorEnabled: true, sessionTwoFactorVerified: true };
  const unsatisfiedActor = { userTwoFactorEnabled: false, sessionTwoFactorVerified: false };

  const storedDisabled = { enabled: false, gracePeriodDays: 7, enforcedFrom: null };

  // Enabled with an active grace window: enforcedFrom 1 day ago + 30 days.
  const storedEnabledActiveGrace = {
    enabled: true,
    gracePeriodDays: 30,
    enforcedFrom: '2026-05-31T00:00:00.000Z',
  };

  describe('license gate', () => {
    it('rejects enabling on an unlicensed instance', () => {
      const decision = evaluateInstanceTwoFactorEnforcementUpdate({
        stored: storedDisabled,
        update: { enabled: true, gracePeriodDays: 7 },
        isLicensed: false,
        actor: satisfiedActor,
        now,
      });

      expect(decision).toEqual({ allowed: false, reason: 'UNLICENSED' });
    });

    it('rejects changing values while enabled on an unlicensed instance', () => {
      const decision = evaluateInstanceTwoFactorEnforcementUpdate({
        stored: storedEnabledActiveGrace,
        update: { enabled: true, gracePeriodDays: 60 },
        isLicensed: false,
        actor: satisfiedActor,
        now,
      });

      expect(decision).toEqual({ allowed: false, reason: 'UNLICENSED' });
    });

    it('rejects an unlicensed disabled→disabled no-op write', () => {
      const decision = evaluateInstanceTwoFactorEnforcementUpdate({
        stored: storedDisabled,
        update: { enabled: false, gracePeriodDays: 7 },
        isLicensed: false,
        actor: satisfiedActor,
        now,
      });

      expect(decision).toEqual({ allowed: false, reason: 'UNLICENSED' });
    });

    it('rejects an unlicensed disable that also changes the grace period', () => {
      const decision = evaluateInstanceTwoFactorEnforcementUpdate({
        stored: storedEnabledActiveGrace,
        update: { enabled: false, gracePeriodDays: 60 },
        isLicensed: false,
        actor: satisfiedActor,
        now,
      });

      expect(decision).toEqual({ allowed: false, reason: 'UNLICENSED' });
    });

    it('allows an unlicensed disable-only update with values unchanged from stored', () => {
      const decision = evaluateInstanceTwoFactorEnforcementUpdate({
        stored: storedEnabledActiveGrace,
        update: { enabled: false, gracePeriodDays: storedEnabledActiveGrace.gracePeriodDays },
        isLicensed: false,
        // Even an unenrolled admin may disable — walking the policy back must
        // never be gated on satisfying it.
        actor: unsatisfiedActor,
        now,
      });

      expect(decision).toEqual({
        allowed: true,
        next: {
          enabled: false,
          gracePeriodDays: storedEnabledActiveGrace.gracePeriodDays,
          enforcedFrom: storedEnabledActiveGrace.enforcedFrom,
        },
      });
    });
  });

  describe('enable-time guard', () => {
    it('rejects enabling when the acting admin does not satisfy the policy', () => {
      const decision = evaluateInstanceTwoFactorEnforcementUpdate({
        stored: storedDisabled,
        update: { enabled: true, gracePeriodDays: 0 },
        isLicensed: true,
        actor: unsatisfiedActor,
        now,
      });

      expect(decision).toEqual({ allowed: false, reason: 'ENABLE_REQUIRES_ACTOR_TWO_FACTOR' });
    });

    it('rejects enabling when the actor is enrolled but the session is unverified', () => {
      const decision = evaluateInstanceTwoFactorEnforcementUpdate({
        stored: storedDisabled,
        update: { enabled: true, gracePeriodDays: 7 },
        isLicensed: true,
        actor: { userTwoFactorEnabled: true, sessionTwoFactorVerified: false },
        now,
      });

      expect(decision).toEqual({ allowed: false, reason: 'ENABLE_REQUIRES_ACTOR_TWO_FACTOR' });
    });

    it('does not apply the guard when updating values while already enabled', () => {
      const decision = evaluateInstanceTwoFactorEnforcementUpdate({
        stored: storedEnabledActiveGrace,
        update: { enabled: true, gracePeriodDays: 60 },
        isLicensed: true,
        actor: unsatisfiedActor,
        now,
      });

      expect(decision).toMatchObject({ allowed: true });
    });
  });

  describe('enforcedFrom handling', () => {
    it('sets enforcedFrom to now on an off→on transition', () => {
      const decision = evaluateInstanceTwoFactorEnforcementUpdate({
        stored: storedDisabled,
        update: { enabled: true, gracePeriodDays: 14 },
        isLicensed: true,
        actor: satisfiedActor,
        now,
      });

      expect(decision).toEqual({
        allowed: true,
        next: { enabled: true, gracePeriodDays: 14, enforcedFrom: now.toISOString() },
      });
    });

    it('preserves enforcedFrom when the policy stays enabled', () => {
      const decision = evaluateInstanceTwoFactorEnforcementUpdate({
        stored: storedEnabledActiveGrace,
        update: { enabled: true, gracePeriodDays: 60 },
        isLicensed: true,
        actor: satisfiedActor,
        now,
      });

      expect(decision).toEqual({
        allowed: true,
        next: { enabled: true, gracePeriodDays: 60, enforcedFrom: storedEnabledActiveGrace.enforcedFrom },
      });
    });

    it('preserves enforcedFrom on disable', () => {
      const decision = evaluateInstanceTwoFactorEnforcementUpdate({
        stored: storedEnabledActiveGrace,
        update: { enabled: false, gracePeriodDays: storedEnabledActiveGrace.gracePeriodDays },
        isLicensed: true,
        actor: satisfiedActor,
        now,
      });

      expect(decision).toEqual({
        allowed: true,
        next: {
          enabled: false,
          gracePeriodDays: storedEnabledActiveGrace.gracePeriodDays,
          enforcedFrom: storedEnabledActiveGrace.enforcedFrom,
        },
      });
    });
  });

  describe('grace-reduction acknowledgement', () => {
    it('rejects reducing an active grace period without acknowledgement', () => {
      const decision = evaluateInstanceTwoFactorEnforcementUpdate({
        stored: storedEnabledActiveGrace,
        update: { enabled: true, gracePeriodDays: 1 },
        isLicensed: true,
        actor: satisfiedActor,
        now,
      });

      expect(decision).toEqual({ allowed: false, reason: 'GRACE_REDUCTION_NOT_ACKNOWLEDGED' });
    });

    it('allows reducing an active grace period with acknowledgement', () => {
      const decision = evaluateInstanceTwoFactorEnforcementUpdate({
        stored: storedEnabledActiveGrace,
        update: { enabled: true, gracePeriodDays: 1, acknowledgeGracePeriodReduction: true },
        isLicensed: true,
        actor: satisfiedActor,
        now,
      });

      expect(decision).toEqual({
        allowed: true,
        next: { enabled: true, gracePeriodDays: 1, enforcedFrom: storedEnabledActiveGrace.enforcedFrom },
      });
    });

    it('does not require acknowledgement when enabling for the first time', () => {
      const decision = evaluateInstanceTwoFactorEnforcementUpdate({
        stored: storedDisabled,
        update: { enabled: true, gracePeriodDays: 0 },
        isLicensed: true,
        actor: satisfiedActor,
        now,
      });

      expect(decision).toMatchObject({ allowed: true });
    });

    it('does not require acknowledgement when tightening an already-expired window', () => {
      const decision = evaluateInstanceTwoFactorEnforcementUpdate({
        stored: {
          enabled: true,
          gracePeriodDays: 7,
          enforcedFrom: '2026-01-01T00:00:00.000Z',
        },
        update: { enabled: true, gracePeriodDays: 0 },
        isLicensed: true,
        actor: satisfiedActor,
        now,
      });

      expect(decision).toMatchObject({ allowed: true });
    });
  });
});

describe('calculateTwoFactorDeadlineTimerDelay', () => {
  const now = new Date('2026-06-01T00:00:00.000Z');

  it('returns the exact delay for a deadline within the timer range', () => {
    const deadline = new Date(now.getTime() + 5_000);

    expect(calculateTwoFactorDeadlineTimerDelay({ deadline, now })).toBe(5_000);
  });

  it('returns 0 for a deadline at the current instant (deadline counts as expired)', () => {
    expect(calculateTwoFactorDeadlineTimerDelay({ deadline: now, now })).toBe(0);
  });

  it('returns 0 for a past deadline', () => {
    const deadline = new Date(now.getTime() - 60_000);

    expect(calculateTwoFactorDeadlineTimerDelay({ deadline, now })).toBe(0);
  });

  it('returns the delay at exactly the setTimeout maximum', () => {
    const deadline = new Date(now.getTime() + MAX_TWO_FACTOR_DEADLINE_TIMER_DELAY_MS);

    expect(calculateTwoFactorDeadlineTimerDelay({ deadline, now })).toBe(MAX_TWO_FACTOR_DEADLINE_TIMER_DELAY_MS);
  });

  it('returns null when the deadline exceeds the setTimeout maximum', () => {
    const deadline = new Date(now.getTime() + MAX_TWO_FACTOR_DEADLINE_TIMER_DELAY_MS + 1);

    expect(calculateTwoFactorDeadlineTimerDelay({ deadline, now })).toBeNull();
  });

  it('returns null for a deadline months away', () => {
    const deadline = new Date('2026-12-01T00:00:00.000Z');

    expect(calculateTwoFactorDeadlineTimerDelay({ deadline, now })).toBeNull();
  });
});
