/**
 * 2FA enforcement drift guard.
 *
 * Static, import-only structural test (no queries are executed): every
 * procedure built on a session-reachable base (authenticated / admin /
 * maybeAuthenticated — identified via the `trpcAuthType` marker set on the
 * base procedures) MUST carry EXACTLY ONE inline enforcement middleware
 * (`twoFactorScope` / `twoFactorScopeFromCtx` / `twoFactorInstanceOnly` /
 * `twoFactorRemediation` / `twoFactorBootstrap`), detected by its `_type`
 * tag while walking `_def.middlewares`.
 *
 * CONTRACT (see `./enforce.ts` and the session middlewares in `../trpc.ts`):
 * the session middlewares run NO enforcement of their own — the runtime is
 * FAIL-OPEN for a procedure without an inline enforcement middleware. THIS
 * TEST is the enforcement net: the coverage assertion below fails any
 * session-reachable procedure without one. Do not weaken it.
 *
 * The `instanceOnly`, `remediation` and `bootstrap` variants are explicit,
 * justified allow-lists — their exact membership is asserted below so
 * additions are always deliberate and reviewed. Every allow-listed call site
 * must carry a justification comment.
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

/**
 * Non-admin procedures with `twoFactorInstanceOnly()` — no organisation
 * scope; the instance assert still applies. Every entry must carry a
 * justification comment at its call site. Additions must be deliberate —
 * organisation-scope resolution is always preferred over instance-only.
 *
 * The admin router is excluded here because ALL admin procedures inherit
 * `twoFactorInstanceOnly()` from the `adminProcedure` base (instance-admin
 * context, not organisation-member access) — asserted separately below.
 */
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

/**
 * Org-assert exemptions for remediation (`twoFactorRemediation()`): a
 * blocked member must always be able to walk away (leave / decline) or join
 * (accept — joining is never blocked). The instance assert still applies.
 */
const REMEDIATION_ALLOW_LIST = [
  'organisation.leave',
  'organisation.member.invite.accept',
  'organisation.member.invite.decline',
].sort();

/**
 * The session bootstrap (`twoFactorBootstrap()`): a blocked client must be
 * able to discover its own enforcement state. Exempt from BOTH asserts.
 */
const BOOTSTRAP_ALLOW_LIST = ['organisation.internal.getOrganisationSession'].sort();

describe('2FA enforcement drift guard', () => {
  it('every session-reachable procedure carries exactly one enforcement middleware', () => {
    // THE enforcement net. The session middlewares run no enforcement of
    // their own, so a procedure without an inline enforcement middleware
    // slips through at runtime — it must fail here instead.
    const uncovered = sessionReachableProcedures()
      .filter((procedure) => procedure.variants.length === 0)
      .map((procedure) => procedure.path);

    expect(
      uncovered,
      `No 2FA enforcement middleware (twoFactorScope / twoFactorScopeFromCtx / a named variant) on: ${uncovered.join(', ')}`,
    ).toEqual([]);

    // Duplicates would assert twice with potentially conflicting scopes —
    // exactly one middleware must own each route.
    const duplicated = sessionReachableProcedures()
      .filter((procedure) => procedure.variants.length > 1)
      .map((procedure) => `${procedure.path} (${procedure.variants.join(' + ')})`);

    expect(duplicated, `Multiple 2FA enforcement middlewares on: ${duplicated.join(', ')}`).toEqual([]);
  });

  it('the appRouter contains session-reachable procedures (sanity check)', () => {
    // Guards against the marker meta being silently dropped, which would make
    // the coverage assertion above vacuously pass.
    expect(sessionReachableProcedures().length).toBeGreaterThan(150);
  });

  it('enforcement middlewares are detectable (sanity floor)', () => {
    // Guards against the `_type` tag being silently dropped — which would
    // make the coverage assertion fail loudly, but this pins the expected
    // scale explicitly so a partial regression cannot hide.
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
    // `createInlineMiddleware` always sets BOTH tags. A hand-written
    // middleware that only sets `_type` must not satisfy the coverage
    // assertion — it would tag a procedure as enforced without running any
    // enforcement logic.
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
