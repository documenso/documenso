import type {
  EnforcementSession,
  EnforcementUser,
  OrganisationTwoFactorScope,
} from '@documenso/lib/server-only/2fa/org-enforcement';
import { assertOrganisationScopesTwoFactorEnforcement } from '@documenso/lib/server-only/2fa/org-enforcement';
import { isTwoFactorSatisfied } from '@documenso/lib/utils/two-factor';
import type { TRPCMiddlewareFunction } from '@trpc/server';

import type { TrpcContext } from '../context';
import type { TrpcRouteMeta } from '../trpc';
import {
  getInstanceStatusCached,
  getRequestCache,
  loadAllOrgScopesCached,
  loadOrgScopesCached,
  resolveResourceOrgIdsCached,
  throwTwoFactorRequired,
} from './resolution';
import type { TwoFactorScopeResult } from './scope';
import { normalizeTwoFactorScopeResult, TWO_FACTOR_CTX_TEAM, TWO_FACTOR_SKIP } from './scope';

export type { TwoFactorScopeDescriptor, TwoFactorScopeResult } from './scope';
export { TWO_FACTOR_CTX_TEAM, TWO_FACTOR_SKIP } from './scope';

/**
 * These middlewares are the ONLY 2FA enforcement path: the session middlewares
 * in `../trpc.ts` run no enforcement of their own, so the runtime is FAIL-OPEN
 * for a procedure that carries none of them. The drift guard
 * (`drift-guard.test.ts`) fails CI for any session-reachable procedure without
 * exactly one. Do not weaken it.
 *
 * They must be placed after `.input()` so the scope resolver receives parsed,
 * typed input.
 */

export type TwoFactorEnforcementResolution =
  | { state: 'skipped'; reason: 'machineOrAnonymous' | 'tokenAuthorized' | 'bootstrapExempt' }
  | { state: 'satisfied' }
  | { state: 'asserted'; organisationIds: string[] };

// Runtime tag the drift guard looks for when walking `_def.middlewares`.
export const TWO_FACTOR_INLINE_MIDDLEWARE_TYPE = 'twoFactorEnforcementInline';

export type TwoFactorInlineVariant = 'scope' | 'instanceOnly' | 'remediation' | 'bootstrap';

type TaggedMiddleware = {
  _type?: string | undefined;
  _twoFactorVariant?: TwoFactorInlineVariant | undefined;
};

export const isTwoFactorInlineMiddleware = (middleware: TaggedMiddleware): boolean =>
  middleware._type === TWO_FACTOR_INLINE_MIDDLEWARE_TYPE;

/**
 * A middleware carrying only the `_type` tag is a hand-written impostor and must
 * not count as drift guard coverage.
 */
export const getTwoFactorInlineMiddlewareVariant = (middleware: TaggedMiddleware): TwoFactorInlineVariant | null => {
  if (!isTwoFactorInlineMiddleware(middleware)) {
    return null;
  }

  return middleware._twoFactorVariant ?? null;
};

// Mirrors tRPC's internal `Overwrite`, which is not exported from `@trpc/server`.
type ContextOverwrite<TType, TWith> = TWith extends object ? Omit<TType, keyof TWith> & TWith : TWith;

// The session middlewares only ever spread the existing context, so these fields
// are never overridden with different types and the cast below is safe.
type InlineEnforcementContextView = {
  req: Request;
  teamId: number | undefined;
  user: EnforcementUser | null;
  session: NonNullable<EnforcementSession> | null;
};

type InlineMiddleware<TContextOverridesIn, TInput> = TRPCMiddlewareFunction<
  TrpcContext,
  TrpcRouteMeta,
  TContextOverridesIn,
  { twoFactorEnforcement: TwoFactorEnforcementResolution },
  TInput
>;

const createInlineMiddleware = <TContextOverridesIn, TInput>(
  resolveScope: (input: TInput, ctx: ContextOverwrite<TrpcContext, TContextOverridesIn>) => TwoFactorScopeResult,
  variant: TwoFactorInlineVariant = 'scope',
): InlineMiddleware<TContextOverridesIn, TInput> => {
  const middleware: InlineMiddleware<TContextOverridesIn, TInput> = async ({ ctx, input, next }) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const { req, teamId, user, session } = ctx as unknown as InlineEnforcementContextView;

    const attachResolution = async (twoFactorEnforcement: TwoFactorEnforcementResolution) =>
      await next({ ctx: { twoFactorEnforcement } });

    // Machine (API token) and anonymous access are exempt by design.
    if (!user || !session) {
      return await attachResolution({ state: 'skipped', reason: 'machineOrAnonymous' });
    }

    if (variant === 'bootstrap') {
      return await attachResolution({ state: 'skipped', reason: 'bootstrapExempt' });
    }

    if (
      isTwoFactorSatisfied({
        userTwoFactorEnabled: user.twoFactorEnabled,
        sessionTwoFactorVerified: session.twoFactorVerified,
      })
    ) {
      return await attachResolution({ state: 'satisfied' });
    }

    // The cast only bridges tRPC's internal `Overwrite` alias and our mirror.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const scope = normalizeTwoFactorScopeResult(
      resolveScope(input, ctx as ContextOverwrite<TrpcContext, TContextOverridesIn>),
    );

    // Token-authorized: an instance-blocked user must still be able to open
    // someone else's signing link while signed in.
    if (scope.type === 'skip') {
      return await attachResolution({ state: 'skipped', reason: 'tokenAuthorized' });
    }

    const cache = getRequestCache(req);

    const instanceStatus = await getInstanceStatusCached(cache, user, session);

    if (instanceStatus.required && instanceStatus.isBlocked) {
      throwTwoFactorRequired();
    }

    let scopes: OrganisationTwoFactorScope[];

    if (scope.type === 'ctxTeam') {
      // Without a team header the procedure is a cross-organisation query, so
      // every membership organisation is in scope.
      if (teamId !== undefined && teamId > 0) {
        const organisationIds = await resolveResourceOrgIdsCached(cache, user.id, {
          kind: 'team',
          teamIds: [teamId],
        });

        scopes = await loadOrgScopesCached(cache, user.id, organisationIds);
      } else {
        scopes = await loadAllOrgScopesCached(cache, user.id);
      }
    } else {
      const organisationIds: string[] = [];

      for (const resource of scope.resources) {
        organisationIds.push(...(await resolveResourceOrgIdsCached(cache, user.id, resource)));
      }

      scopes = await loadOrgScopesCached(cache, user.id, organisationIds);
    }

    assertOrganisationScopesTwoFactorEnforcement({ user, session, scopes });

    return await attachResolution({
      state: 'asserted',
      organisationIds: scopes.map((organisationScope) => organisationScope.organisationId),
    });
  };

  middleware._type = TWO_FACTOR_INLINE_MIDDLEWARE_TYPE;

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  (middleware as TaggedMiddleware)._twoFactorVariant = variant;

  return middleware;
};

export const twoFactorScope = <TInput, TContextOverridesIn = object>(
  resolveScope: (input: TInput, ctx: ContextOverwrite<TrpcContext, TContextOverridesIn>) => TwoFactorScopeResult,
): InlineMiddleware<TContextOverridesIn, TInput> => createInlineMiddleware(resolveScope);

export const twoFactorScopeFromCtx = <TContextOverridesIn = object>(): InlineMiddleware<TContextOverridesIn, unknown> =>
  createInlineMiddleware(() => TWO_FACTOR_CTX_TEAM);

/**
 * Instance assert only. The drift guard snapshot-asserts the exact membership
 * so additions are always deliberate; prefer `twoFactorScope` where any
 * organisation scope exists.
 */
export const twoFactorInstanceOnly = <TContextOverridesIn = object>(): InlineMiddleware<TContextOverridesIn, unknown> =>
  createInlineMiddleware(() => ({}), 'instanceOnly');

/**
 * Organisation assert exempt: a blocked member must always be able to walk away
 * (leave, accept/decline invite). Membership is snapshot-asserted by the drift
 * guard.
 */
export const twoFactorRemediation = <TContextOverridesIn = object>(): InlineMiddleware<TContextOverridesIn, unknown> =>
  createInlineMiddleware(() => ({}), 'remediation');

/**
 * Both asserts exempt: a blocked client must be able to discover its own
 * enforcement state. Membership is snapshot-asserted by the drift guard.
 */
export const twoFactorBootstrap = <TContextOverridesIn = object>(): InlineMiddleware<TContextOverridesIn, unknown> =>
  createInlineMiddleware(() => TWO_FACTOR_SKIP, 'bootstrap');
