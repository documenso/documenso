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
 * Inline (route-level) 2FA enforcement.
 *
 * `twoFactorScope` / `twoFactorScopeFromCtx` produce plain tRPC middlewares
 * for `.use()`, placed anywhere after `.input()`:
 *
 * ```ts
 * export const getEnvelopeRoute = authenticatedProcedure
 *   .meta(getEnvelopeMeta)
 *   .input(ZGetEnvelopeRequestSchema)
 *   .output(ZGetEnvelopeResponseSchema)
 *   .use(twoFactorScope((input) => ({ envelope: input.envelopeId })))
 *   .query(async ({ input, ctx }) => { ... });
 * ```
 *
 * The scope resolver is a plain typed function of the PARSED input — the
 * `TInput` generic is inferred from `.use()`'s expected middleware signature
 * (which carries the builder's accumulated input type), so referencing a
 * field the schema does not produce is a compile error. No marker meta is
 * involved.
 *
 * These middlewares are the ONLY 2FA enforcement path: the session
 * middlewares in `../trpc.ts` run no enforcement of their own, so the
 * runtime is FAIL-OPEN for a procedure that carries none of them. The drift
 * guard (`drift-guard.test.ts`) walks `_def.middlewares` for the `_type` tag
 * below and fails CI for any session-reachable procedure without exactly one
 * enforcement middleware. That test is the enforcement net — do not weaken
 * it.
 *
 * Enforcement ordering:
 *
 * - `.input()` parsing runs first, so a validation failure surfaces BEFORE
 *   any enforcement error.
 * - This middleware then runs with typed input:
 *   a. Machine (API token) and anonymous calls pass through — enforcement
 *      targets session auth only (machine access is exempt by design).
 *   b. Satisfied users (enrolled + verified session) early-out cheaply.
 *   c. The resolver runs. `TWO_FACTOR_SKIP` skips BOTH asserts — an
 *      instance-blocked user must still be able to open someone else's
 *      signing link while signed in, and deciding that requires the parsed
 *      input.
 *   d. Instance assert, then organisation assert over the resolved scopes
 *      (cache/budget/batching machinery in `./resolution.ts`).
 * - The resolution lands on `ctx.twoFactorEnforcement` for handlers (future
 *   authz unification).
 *
 * The named variants (`twoFactorInstanceOnly` / `twoFactorRemediation` /
 * `twoFactorBootstrap`) are justified exemption allow-lists — see their
 * docblocks below; the drift guard snapshot-asserts their exact membership.
 */

/**
 * The enforcement outcome, attached to `ctx` for downstream consumption.
 */
export type TwoFactorEnforcementResolution =
  | { state: 'skipped'; reason: 'machineOrAnonymous' | 'tokenAuthorized' | 'bootstrapExempt' }
  | { state: 'satisfied' }
  | { state: 'asserted'; organisationIds: string[] };

/**
 * Runtime tag on the inline middleware function so the drift guard can verify
 * — by walking `procedure._def.middlewares` — that every session-reachable
 * procedure actually carries an enforcement middleware.
 */
export const TWO_FACTOR_INLINE_MIDDLEWARE_TYPE = 'twoFactorEnforcementInline';

/**
 * The enforcement variant, tagged onto the middleware function alongside
 * `_type` so the drift guard can snapshot-assert the allow-lists of the
 * exemption variants:
 *
 * - `'scope'`: `twoFactorScope` / `twoFactorScopeFromCtx` — full enforcement
 *   (instance assert + organisation assert over the resolved scopes).
 * - `'instanceOnly'`: `twoFactorInstanceOnly` — no organisation scope
 *   (justified allow-list); the instance assert still applies.
 * - `'remediation'`: `twoFactorRemediation` — organisation assert exempt (a
 *   blocked member must always be able to walk away); the instance assert
 *   still applies.
 * - `'bootstrap'`: `twoFactorBootstrap` — BOTH asserts exempt (a blocked
 *   client must be able to discover its own enforcement state).
 */
export type TwoFactorInlineVariant = 'scope' | 'instanceOnly' | 'remediation' | 'bootstrap';

type TaggedMiddleware = {
  _type?: string | undefined;
  _twoFactorVariant?: TwoFactorInlineVariant | undefined;
};

export const isTwoFactorInlineMiddleware = (middleware: TaggedMiddleware): boolean =>
  middleware._type === TWO_FACTOR_INLINE_MIDDLEWARE_TYPE;

/**
 * The variant of an inline enforcement middleware, or `null` when the
 * middleware is not one. Used by the drift guard to snapshot-assert the
 * exemption allow-lists.
 *
 * Both tags are required: `createInlineMiddleware` always sets
 * `_twoFactorVariant`, so a middleware carrying only the `_type` tag is a
 * hand-written impostor — it must NOT count as coverage (the drift guard then
 * reports the procedure as unenforced instead of silently accepting it).
 */
export const getTwoFactorInlineMiddlewareVariant = (middleware: TaggedMiddleware): TwoFactorInlineVariant | null => {
  if (!isTwoFactorInlineMiddleware(middleware)) {
    return null;
  }

  return middleware._twoFactorVariant ?? null;
};

/**
 * Mirrors tRPC's internal `Overwrite` (not exported from `@trpc/server`):
 * the shape of the context after the base procedure's middlewares have
 * applied their overrides. Used to give scope resolvers the real, narrowed
 * context type (e.g. non-null `user` on `authenticatedProcedure`).
 */
type ContextOverwrite<TType, TWith> = TWith extends object ? Omit<TType, keyof TWith> & TWith : TWith;

/**
 * The minimal, auth-relevant view of the context this middleware needs. The
 * session middlewares only ever spread the existing context, so these fields
 * are never overridden with different types — the cast below is safe.
 */
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

    // Machine access (API token: `session === null`) is exempt by design, and
    // anonymous `maybeAuthenticated` calls carry nothing to enforce against —
    // enforcement targets session auth only.
    if (!user || !session) {
      return await attachResolution({ state: 'skipped', reason: 'machineOrAnonymous' });
    }

    // Bootstrap: BOTH asserts exempt — the blocked client must be able to
    // discover its own enforcement state.
    if (variant === 'bootstrap') {
      return await attachResolution({ state: 'skipped', reason: 'bootstrapExempt' });
    }

    // Cheap early-out: a satisfied user can never be blocked at either level
    // (isBlocked = isDeadlineExpired && !isSatisfied). Runs before the
    // resolver so the common compliant case costs nothing.
    if (
      isTwoFactorSatisfied({
        userTwoFactorEnabled: user.twoFactorEnabled,
        sessionTwoFactorVerified: session.twoFactorVerified,
      })
    ) {
      return await attachResolution({ state: 'satisfied' });
    }

    // The middleware's `ctx` and the resolver's declared `ctx` are the same
    // shape (tRPC types it as `Overwrite<TContext, TContextOverridesIn>`);
    // the cast only bridges tRPC's internal `Overwrite`/`Simplify` aliases
    // and our structural mirror of them.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const scope = normalizeTwoFactorScopeResult(
      resolveScope(input, ctx as ContextOverwrite<TrpcContext, TContextOverridesIn>),
    );

    // Token-authorized: skip BOTH asserts (see the ordering comment above).
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
      // Team context from the `x-team-id` header. Without a team header the
      // procedure is a cross-organisation query, so every membership
      // organisation is in scope (conservative).
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

/**
 * Route-level 2FA enforcement scoped by a typed resolver over the parsed
 * input. Pass to `.use()` after `.input()`:
 *
 * ```ts
 * .use(twoFactorScope((input) => ({ envelope: input.envelopeId })))
 * ```
 *
 * `TInput` and `TContextOverridesIn` are inferred from `.use()`'s expected
 * middleware signature (inference from the contextual type of the call), so
 * both the input and the context the resolver sees are the builder's real
 * accumulated types — no annotations needed at the call site.
 *
 * The resolver returns:
 * - a scope descriptor, e.g. `{ envelope: input.envelopeId }` (values may be
 *   arrays; `{}` = no organisation scope, instance assert only);
 * - an array of descriptors;
 * - `TWO_FACTOR_SKIP` — token-authorized call, skip both asserts;
 * - `TWO_FACTOR_CTX_TEAM` — scope to the `x-team-id` team context (prefer
 *   `twoFactorScopeFromCtx()` when the whole route scopes this way).
 */
export const twoFactorScope = <TInput, TContextOverridesIn = object>(
  resolveScope: (input: TInput, ctx: ContextOverwrite<TrpcContext, TContextOverridesIn>) => TwoFactorScopeResult,
): InlineMiddleware<TContextOverridesIn, TInput> => createInlineMiddleware(resolveScope);

/**
 * Route-level 2FA enforcement scoped to the team context from the
 * `x-team-id` header (`ctx.teamId`) — the inline equivalent of the meta
 * path's `'ctxTeam'` declaration. Without a team header the procedure is
 * treated as a cross-organisation query and every membership organisation is
 * in scope (conservative).
 *
 * ```ts
 * .use(twoFactorScopeFromCtx())
 * ```
 */
export const twoFactorScopeFromCtx = <TContextOverridesIn = object>(): InlineMiddleware<TContextOverridesIn, unknown> =>
  createInlineMiddleware(() => TWO_FACTOR_CTX_TEAM);

/**
 * Route-level 2FA enforcement with NO organisation scope: the instance assert
 * still applies, the organisation assert never runs.
 *
 * This is a justified allow-list — every `.use(twoFactorInstanceOnly())`
 * call site must carry a comment explaining why the route has no
 * organisation scope, and the drift guard snapshot-asserts the exact
 * membership so additions are always deliberate. Organisation-scope
 * resolution (`twoFactorScope` / `twoFactorScopeFromCtx`) is always
 * preferred over this.
 */
export const twoFactorInstanceOnly = <TContextOverridesIn = object>(): InlineMiddleware<TContextOverridesIn, unknown> =>
  createInlineMiddleware(() => ({}), 'instanceOnly');

/**
 * Route-level 2FA enforcement for remediation routes: the instance assert
 * still applies, but the organisation assert is exempt — a blocked member
 * must always be able to walk away (organisation.leave, invite
 * accept/decline; joining is never blocked, access is).
 *
 * Justified allow-list: every call site needs a justification comment, and
 * the drift guard snapshot-asserts the exact membership.
 */
export const twoFactorRemediation = <TContextOverridesIn = object>(): InlineMiddleware<TContextOverridesIn, unknown> =>
  createInlineMiddleware(() => ({}), 'remediation');

/**
 * Route-level 2FA enforcement exemption for the session bootstrap: BOTH the
 * instance and organisation asserts are exempt — a blocked client must be
 * able to discover its own enforcement state
 * (organisation.internal.getOrganisationSession).
 *
 * Justified allow-list: every call site needs a justification comment, and
 * the drift guard snapshot-asserts the exact membership.
 */
export const twoFactorBootstrap = <TContextOverridesIn = object>(): InlineMiddleware<TContextOverridesIn, unknown> =>
  createInlineMiddleware(() => TWO_FACTOR_SKIP, 'bootstrap');
