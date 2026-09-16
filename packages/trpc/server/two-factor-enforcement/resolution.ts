import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getTwoFactorEnforcementStatus } from '@documenso/lib/server-only/2fa/get-two-factor-enforcement-status';
import type {
  EnforcementSession,
  EnforcementUser,
  OrganisationTwoFactorScope,
} from '@documenso/lib/server-only/2fa/org-enforcement';
import { loadOrganisationTwoFactorScopes } from '@documenso/lib/server-only/2fa/org-enforcement';
import { mapDocumentIdToSecondaryId, mapTemplateIdToSecondaryId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

import type { TwoFactorEnforcementResourceIds } from './scope';
import { assertScopeBudget } from './scope';

/**
 * Shared resolution machinery for the inline 2FA enforcement path
 * (`twoFactorScope` / `twoFactorScopeFromCtx` and the named exemption
 * variants in `./enforce.ts`, running post-`.input()` as route-level
 * middlewares).
 *
 * Holds the per-request cache, the membership-qualified resource → org batch
 * lookups, the budget caps and the instance-status cache. Policy decisions
 * (which asserts apply, skip semantics) live with the callers.
 */

/**
 * Per-request enforcement cache, keyed by the underlying `Request` object so
 * batched tRPC calls within one HTTP request share lookups. `WeakMap` keeps
 * this leak-free without touching the context type.
 */
export type RequestEnforcementCache = {
  instanceStatusPromise?: ReturnType<typeof getTwoFactorEnforcementStatus>;
  allOrgScopesPromise?: Promise<OrganisationTwoFactorScope[]>;

  /**
   * Organisation ID → enforcement scope (or null when the user is not a
   * member / the organisation does not exist).
   */
  orgScopeCache: Map<string, OrganisationTwoFactorScope | null>;

  /**
   * `${kind}:${id}` → resolved organisation IDs for a resource.
   */
  resourceOrgIdCache: Map<string, string[]>;

  /**
   * Budget tracking: unique resource IDs + organisation IDs touched by this
   * request. Exceeding the cap rejects the request.
   */
  uniqueScopeKeys: Set<string>;
};

const requestCaches = new WeakMap<Request, RequestEnforcementCache>();

export const getRequestCache = (req: Request): RequestEnforcementCache => {
  let cache = requestCaches.get(req);

  if (!cache) {
    cache = {
      orgScopeCache: new Map(),
      resourceOrgIdCache: new Map(),
      uniqueScopeKeys: new Set(),
    };

    requestCaches.set(req, cache);
  }

  return cache;
};

const trackScopeKeys = (cache: RequestEnforcementCache, keys: Array<string | number>, prefix: string): void => {
  for (const key of keys) {
    cache.uniqueScopeKeys.add(`${prefix}:${key}`);
  }

  assertScopeBudget(cache.uniqueScopeKeys.size);
};

type OrgMemberQualifier = {
  organisation: {
    members: {
      some: {
        userId: number;
      };
    };
  };
};

const buildOrgMemberQualifier = (userId: number): OrgMemberQualifier => ({
  organisation: {
    members: {
      some: {
        userId,
      },
    },
  },
});

/**
 * Maps extracted resource IDs to the owning organisation IDs with a single
 * membership-qualified batch query per resource kind.
 *
 * IDs that do not resolve (nonexistent, or not accessible to the user) simply
 * contribute no scope — the handler's own authorization rejects those
 * requests, and enforcement only concerns organisations the user can access.
 */
const resolveResourceOrganisationIds = async (
  userId: number,
  resourceIds: TwoFactorEnforcementResourceIds,
): Promise<string[]> => {
  switch (resourceIds.kind) {
    case 'organisation': {
      return resourceIds.organisationIds;
    }

    case 'organisationReference': {
      if (resourceIds.references.length === 0) {
        return [];
      }

      const organisations = await prisma.organisation.findMany({
        where: {
          OR: [{ id: { in: resourceIds.references } }, { url: { in: resourceIds.references } }],
          members: { some: { userId } },
        },
        select: { id: true },
      });

      return organisations.map((organisation) => organisation.id);
    }

    case 'team': {
      if (resourceIds.teamIds.length === 0) {
        return [];
      }

      const teams = await prisma.team.findMany({
        where: {
          id: { in: resourceIds.teamIds },
          ...buildOrgMemberQualifier(userId),
        },
        select: { organisationId: true },
      });

      return teams.map((team) => team.organisationId);
    }

    case 'teamReference': {
      const teamIds = resourceIds.references.filter((reference): reference is number => typeof reference === 'number');
      const teamUrls = resourceIds.references.filter((reference): reference is string => typeof reference === 'string');

      if (teamIds.length === 0 && teamUrls.length === 0) {
        return [];
      }

      const teams = await prisma.team.findMany({
        where: {
          OR: [{ id: { in: teamIds } }, { url: { in: teamUrls } }],
          ...buildOrgMemberQualifier(userId),
        },
        select: { organisationId: true },
      });

      return teams.map((team) => team.organisationId);
    }

    case 'envelope':
    case 'document':
    case 'template': {
      const envelopeIds = resourceIds.kind === 'envelope' ? resourceIds.envelopeIds : [];

      const secondaryIds = [
        ...(resourceIds.kind !== 'template' ? resourceIds.documentIds.map((id) => mapDocumentIdToSecondaryId(id)) : []),
        ...(resourceIds.kind !== 'document' ? resourceIds.templateIds.map((id) => mapTemplateIdToSecondaryId(id)) : []),
      ];

      if (envelopeIds.length === 0 && secondaryIds.length === 0) {
        return [];
      }

      const envelopes = await prisma.envelope.findMany({
        where: {
          OR: [{ id: { in: envelopeIds } }, { secondaryId: { in: secondaryIds } }],
          team: { organisation: { members: { some: { userId } } } },
        },
        select: { team: { select: { organisationId: true } } },
      });

      return envelopes.map((envelope) => envelope.team.organisationId);
    }

    case 'envelopeItem': {
      if (resourceIds.envelopeItemIds.length === 0) {
        return [];
      }

      const envelopeItems = await prisma.envelopeItem.findMany({
        where: {
          id: { in: resourceIds.envelopeItemIds },
          envelope: { team: { organisation: { members: { some: { userId } } } } },
        },
        select: { envelope: { select: { team: { select: { organisationId: true } } } } },
      });

      return envelopeItems.map((item) => item.envelope.team.organisationId);
    }

    case 'field': {
      if (resourceIds.fieldIds.length === 0) {
        return [];
      }

      const fields = await prisma.field.findMany({
        where: {
          id: { in: resourceIds.fieldIds },
          envelope: { team: { organisation: { members: { some: { userId } } } } },
        },
        select: { envelope: { select: { team: { select: { organisationId: true } } } } },
      });

      return fields.map((field) => field.envelope.team.organisationId);
    }

    case 'recipient': {
      if (resourceIds.recipientIds.length === 0) {
        return [];
      }

      const recipients = await prisma.recipient.findMany({
        where: {
          id: { in: resourceIds.recipientIds },
          envelope: { team: { organisation: { members: { some: { userId } } } } },
        },
        select: { envelope: { select: { team: { select: { organisationId: true } } } } },
      });

      return recipients.map((recipient) => recipient.envelope.team.organisationId);
    }

    case 'attachment': {
      if (resourceIds.attachmentIds.length === 0) {
        return [];
      }

      const attachments = await prisma.envelopeAttachment.findMany({
        where: {
          id: { in: resourceIds.attachmentIds },
          envelope: { team: { organisation: { members: { some: { userId } } } } },
        },
        select: { envelope: { select: { team: { select: { organisationId: true } } } } },
      });

      return attachments.map((attachment) => attachment.envelope.team.organisationId);
    }

    case 'folder': {
      if (resourceIds.folderIds.length === 0) {
        return [];
      }

      const folders = await prisma.folder.findMany({
        where: {
          id: { in: resourceIds.folderIds },
          team: { organisation: { members: { some: { userId } } } },
        },
        select: { team: { select: { organisationId: true } } },
      });

      return folders.map((folder) => folder.team.organisationId);
    }

    case 'webhook': {
      if (resourceIds.webhookIds.length === 0) {
        return [];
      }

      const webhooks = await prisma.webhook.findMany({
        where: {
          id: { in: resourceIds.webhookIds },
          team: { organisation: { members: { some: { userId } } } },
        },
        select: { team: { select: { organisationId: true } } },
      });

      return webhooks.map((webhook) => webhook.team.organisationId);
    }

    case 'organisationGroup': {
      if (resourceIds.groupIds.length === 0) {
        return [];
      }

      const groups = await prisma.organisationGroup.findMany({
        where: {
          id: { in: resourceIds.groupIds },
          organisation: { members: { some: { userId } } },
        },
        select: { organisationId: true },
      });

      return groups.map((group) => group.organisationId);
    }

    case 'teamGroup': {
      if (resourceIds.groupIds.length === 0) {
        return [];
      }

      const teamGroups = await prisma.teamGroup.findMany({
        where: {
          id: { in: resourceIds.groupIds },
          team: { organisation: { members: { some: { userId } } } },
        },
        select: { team: { select: { organisationId: true } } },
      });

      return teamGroups.map((teamGroup) => teamGroup.team.organisationId);
    }

    case 'organisationEmail': {
      if (resourceIds.emailIds.length === 0) {
        return [];
      }

      const emails = await prisma.organisationEmail.findMany({
        where: {
          id: { in: resourceIds.emailIds },
          organisation: { members: { some: { userId } } },
        },
        select: { organisationId: true },
      });

      return emails.map((email) => email.organisationId);
    }

    case 'organisationEmailDomain': {
      if (resourceIds.emailDomainIds.length === 0) {
        return [];
      }

      const emailDomains = await prisma.emailDomain.findMany({
        where: {
          id: { in: resourceIds.emailDomainIds },
          organisation: { members: { some: { userId } } },
        },
        select: { organisationId: true },
      });

      return emailDomains.map((emailDomain) => emailDomain.organisationId);
    }
  }
};

const resourceIdsToCacheKeys = (resourceIds: TwoFactorEnforcementResourceIds): Array<string | number> => {
  switch (resourceIds.kind) {
    case 'organisation':
      return resourceIds.organisationIds;
    case 'organisationReference':
      return resourceIds.references;
    case 'team':
      return resourceIds.teamIds;
    case 'teamReference':
      return resourceIds.references;
    case 'envelope':
      return [...resourceIds.envelopeIds, ...resourceIds.documentIds, ...resourceIds.templateIds];
    case 'document':
      return resourceIds.documentIds;
    case 'template':
      return resourceIds.templateIds;
    case 'envelopeItem':
      return resourceIds.envelopeItemIds;
    case 'field':
      return resourceIds.fieldIds;
    case 'recipient':
      return resourceIds.recipientIds;
    case 'attachment':
      return resourceIds.attachmentIds;
    case 'folder':
      return resourceIds.folderIds;
    case 'webhook':
      return resourceIds.webhookIds;
    case 'organisationGroup':
    case 'teamGroup':
      return resourceIds.groupIds;
    case 'organisationEmail':
      return resourceIds.emailIds;
    case 'organisationEmailDomain':
      return resourceIds.emailDomainIds;
  }
};

export const loadOrgScopesCached = async (
  cache: RequestEnforcementCache,
  userId: number,
  organisationIds: string[],
): Promise<OrganisationTwoFactorScope[]> => {
  const uniqueIds = [...new Set(organisationIds)];

  trackScopeKeys(cache, uniqueIds, 'org');

  const missingIds = uniqueIds.filter((id) => !cache.orgScopeCache.has(id));

  if (missingIds.length > 0) {
    const scopes = await loadOrganisationTwoFactorScopes({ userId, organisationIds: missingIds });

    for (const scope of scopes) {
      cache.orgScopeCache.set(scope.organisationId, scope);
    }

    for (const id of missingIds) {
      if (!cache.orgScopeCache.has(id)) {
        cache.orgScopeCache.set(id, null);
      }
    }
  }

  return uniqueIds.flatMap((id) => {
    const scope = cache.orgScopeCache.get(id);

    return scope ? [scope] : [];
  });
};

export const loadAllOrgScopesCached = async (
  cache: RequestEnforcementCache,
  userId: number,
): Promise<OrganisationTwoFactorScope[]> => {
  if (!cache.allOrgScopesPromise) {
    cache.allOrgScopesPromise = loadOrganisationTwoFactorScopes({ userId });
  }

  const scopes = await cache.allOrgScopesPromise;

  trackScopeKeys(
    cache,
    scopes.map((scope) => scope.organisationId),
    'org',
  );

  return scopes;
};

export const resolveResourceOrgIdsCached = async (
  cache: RequestEnforcementCache,
  userId: number,
  resourceIds: TwoFactorEnforcementResourceIds,
): Promise<string[]> => {
  const cacheKeys = resourceIdsToCacheKeys(resourceIds).map((key) => `${resourceIds.kind}:${key}`);

  trackScopeKeys(cache, cacheKeys, 'resource');

  const cachedOrgIds: string[] = [];
  const isFullyCached = cacheKeys.every((key) => cache.resourceOrgIdCache.has(key));

  if (isFullyCached) {
    for (const key of cacheKeys) {
      cachedOrgIds.push(...(cache.resourceOrgIdCache.get(key) ?? []));
    }

    return cachedOrgIds;
  }

  // Partial cache hits are rare (identical calls within a batch are the
  // common case), so on any miss we resolve the full set in one batch query
  // and cache the combined result under every key.
  const organisationIds = await resolveResourceOrganisationIds(userId, resourceIds);

  for (const key of cacheKeys) {
    cache.resourceOrgIdCache.set(key, organisationIds);
  }

  return organisationIds;
};

/**
 * Instance-wide enforcement status, cached per request so batched calls share
 * the setting lookup.
 */
export const getInstanceStatusCached = async (
  cache: RequestEnforcementCache,
  user: EnforcementUser,
  session: NonNullable<EnforcementSession>,
): ReturnType<typeof getTwoFactorEnforcementStatus> => {
  if (!cache.instanceStatusPromise) {
    cache.instanceStatusPromise = getTwoFactorEnforcementStatus({ user, session });
  }

  return await cache.instanceStatusPromise;
};

export const throwTwoFactorRequired = (): never => {
  throw new AppError(AppErrorCode.TWO_FACTOR_REQUIRED, {
    message: 'Two-factor authentication is required to access this resource.',
    userMessage: 'Two-factor authentication is required. Please enable it to continue.',
    statusCode: 403,
  });
};
