/**
 * The session middlewares in `../trpc.ts` run no 2FA enforcement of their own,
 * so the runtime is FAIL-OPEN for a procedure without an inline enforcement
 * middleware. This test is the enforcement net. Do not weaken it.
 */
import { describe, expect, it } from 'vitest';

import { appRouter } from '../router';
import type { TrpcRouteMeta } from '../trpc';
import type { TwoFactorInlineVariant } from './enforce';
import { getTwoFactorInlineMiddlewareVariant, TWO_FACTOR_INLINE_MIDDLEWARE_TYPE } from './enforce';

type ProcedureEntry = {
  path: string;
  meta: TrpcRouteMeta | undefined;
  variants: TwoFactorInlineVariant[];
};

const getProcedures = (): ProcedureEntry[] => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const procedures = appRouter._def.procedures as unknown as Record<
    string,
    {
      _def: {
        meta?: TrpcRouteMeta;
        middlewares?: Array<{ _type?: string; _twoFactorVariant?: TwoFactorInlineVariant }>;
      };
    }
  >;

  return Object.entries(procedures).map(([path, procedure]) => ({
    path,
    meta: procedure._def.meta,
    variants: (procedure._def.middlewares ?? []).flatMap((middleware) => {
      const variant = getTwoFactorInlineMiddlewareVariant(middleware);

      return variant ? [variant] : [];
    }),
  }));
};

const sessionReachableProcedures = () =>
  getProcedures().filter(
    (procedure) =>
      procedure.meta?.trpcAuthType === 'authenticated' ||
      procedure.meta?.trpcAuthType === 'maybeAuthenticated' ||
      procedure.meta?.trpcAuthType === 'admin',
  );

const proceduresWithVariant = (variant: TwoFactorInlineVariant) =>
  sessionReachableProcedures()
    .filter((procedure) => procedure.variants.includes(variant))
    .map((procedure) => procedure.path)
    .sort();

// Admin procedures are excluded here since they all inherit
// `twoFactorInstanceOnly()` from the `adminProcedure` base, asserted separately
// below.
const INSTANCE_ONLY_ALLOW_LIST = [
  'auth.passkey.create',
  'auth.passkey.createAuthenticationOptions',
  'auth.passkey.createRegistrationOptions',
  'auth.passkey.delete',
  'auth.passkey.find',
  'auth.passkey.update',
  'document.inbox.find',
  'document.inbox.getCount',
  'enterprise.billing.plans.get',
  'organisation.create',
  'organisation.getMany',
  'organisation.member.invite.getMany',
  'profile.deleteAccount',
  'profile.findUserSecurityAuditLogs',
  'profile.updateProfile',
  'team.email.get',
].sort();

const REMEDIATION_ALLOW_LIST = [
  'organisation.leave',
  'organisation.member.invite.accept',
  'organisation.member.invite.decline',
].sort();

const BOOTSTRAP_ALLOW_LIST = ['auth.getAuthMethods', 'organisation.internal.getOrganisationSession'].sort();

describe('2FA enforcement drift guard', () => {
  it('every session-reachable procedure carries exactly one enforcement middleware', () => {
    const uncovered = sessionReachableProcedures()
      .filter((procedure) => procedure.variants.length === 0)
      .map((procedure) => procedure.path);

    expect(
      uncovered,
      `No 2FA enforcement middleware (twoFactorScope / twoFactorScopeFromCtx / a named variant) on: ${uncovered.join(', ')}`,
    ).toEqual([]);

    const duplicated = sessionReachableProcedures()
      .filter((procedure) => procedure.variants.length > 1)
      .map((procedure) => `${procedure.path} (${procedure.variants.join(' + ')})`);

    expect(duplicated, `Multiple 2FA enforcement middlewares on: ${duplicated.join(', ')}`).toEqual([]);
  });

  it('the appRouter contains session-reachable procedures (sanity check)', () => {
    // A silently dropped marker meta would make the coverage assertion
    // vacuously pass.
    expect(sessionReachableProcedures().length).toBeGreaterThan(150);
  });

  it('enforcement middlewares are detectable (sanity floor)', () => {
    const covered = sessionReachableProcedures().filter((procedure) => procedure.variants.length > 0);

    expect(covered.length).toBeGreaterThan(150);

    const scoped = proceduresWithVariant('scope');

    expect(scoped.length).toBeGreaterThanOrEqual(43);
  });

  it("the non-admin 'instanceOnly' allow-list matches exactly", () => {
    const instanceOnlyDeclared = sessionReachableProcedures()
      .filter((procedure) => procedure.variants.includes('instanceOnly') && procedure.meta?.trpcAuthType !== 'admin')
      .map((procedure) => procedure.path)
      .sort();

    expect(instanceOnlyDeclared).toEqual(INSTANCE_ONLY_ALLOW_LIST);
  });

  it("the 'remediation' allow-list matches exactly", () => {
    expect(proceduresWithVariant('remediation')).toEqual(REMEDIATION_ALLOW_LIST);
  });

  it("the 'bootstrap' allow-list matches exactly", () => {
    expect(proceduresWithVariant('bootstrap')).toEqual(BOOTSTRAP_ALLOW_LIST);
  });

  it('a middleware carrying only the _type tag does not count as coverage (spoof hardening)', () => {
    expect(getTwoFactorInlineMiddlewareVariant({ _type: TWO_FACTOR_INLINE_MIDDLEWARE_TYPE })).toBeNull();

    expect(
      getTwoFactorInlineMiddlewareVariant({
        _type: TWO_FACTOR_INLINE_MIDDLEWARE_TYPE,
        _twoFactorVariant: 'remediation',
      }),
    ).toBe('remediation');

    expect(getTwoFactorInlineMiddlewareVariant({ _type: 'input' })).toBeNull();
  });

  it('every admin procedure inherits instance-only enforcement from the admin base', () => {
    const adminProcedures = getProcedures().filter((procedure) => procedure.path.startsWith('admin.'));

    expect(adminProcedures.length).toBeGreaterThan(30);

    for (const procedure of adminProcedures) {
      expect(procedure.meta?.trpcAuthType, `${procedure.path} must be built on adminProcedure`).toBe('admin');
      expect(procedure.variants, `${procedure.path} must inherit exactly the base 'instanceOnly' middleware`).toEqual([
        'instanceOnly',
      ]);
    }
  });
});
