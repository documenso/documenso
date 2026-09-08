import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

/**
 * Pure (I/O free) building blocks for the inline (`.use()`-based) 2FA
 * enforcement path: the scope descriptor a route-level resolver returns, the
 * sentinels for the non-resource outcomes, the normalizer that maps a
 * resolver result onto the shared resource-resolution machinery, and the
 * request budget caps.
 *
 * Everything here is unit-testable without a database.
 */

/**
 * Maximum number of IDs a single bulk array may contain before the request is
 * rejected (not truncated).
 */
export const TWO_FACTOR_ENFORCEMENT_MAX_BULK_IDS = 100;

/**
 * Maximum number of cumulative unique organisation scopes a single request
 * (including batched tRPC calls) may resolve before being rejected.
 */
export const TWO_FACTOR_ENFORCEMENT_MAX_UNIQUE_SCOPES = 200;

/**
 * The resource-ID sets consumed by the shared organisation resolution
 * machinery (`./resolution.ts`). Each variant maps to a single
 * membership-qualified batch lookup resolving the IDs to their owning
 * organisation(s).
 */
export type TwoFactorEnforcementResourceIds =
  | { kind: 'organisation'; organisationIds: string[] }
  | { kind: 'organisationReference'; references: string[] }
  | { kind: 'team'; teamIds: number[] }
  | { kind: 'teamReference'; references: Array<string | number> }
  | { kind: 'envelope'; envelopeIds: string[]; documentIds: number[]; templateIds: number[] }
  | { kind: 'document'; documentIds: number[] }
  | { kind: 'template'; templateIds: number[] }
  | { kind: 'envelopeItem'; envelopeItemIds: string[] }
  | { kind: 'field'; fieldIds: number[] }
  | { kind: 'recipient'; recipientIds: number[] }
  | { kind: 'attachment'; attachmentIds: string[] }
  | { kind: 'folder'; folderIds: string[] }
  | { kind: 'webhook'; webhookIds: string[] }
  | { kind: 'organisationGroup'; groupIds: string[] }
  | { kind: 'teamGroup'; groupIds: string[] }
  | { kind: 'organisationEmail'; emailIds: string[] }
  | { kind: 'organisationEmailDomain'; emailDomainIds: string[] };

/**
 * Tracks the cumulative number of unique organisation scopes resolved within
 * a single request and rejects when the budget is exceeded.
 */
export const assertScopeBudget = (uniqueScopeCount: number): void => {
  if (uniqueScopeCount > TWO_FACTOR_ENFORCEMENT_MAX_UNIQUE_SCOPES) {
    throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
      message: 'Too many organisation scopes resolved for a single request.',
      statusCode: 400,
    });
  }
};

/**
 * Sentinel: the call is token-authorized — authorization derives from a token
 * in the input and the session cookie is incidental, so BOTH the instance and
 * organisation asserts are skipped (an instance-blocked user must still be
 * able to open someone else's signing link while signed in).
 */
export const TWO_FACTOR_SKIP = Symbol('TWO_FACTOR_SKIP');

/**
 * Sentinel: the procedure operates in the team context derived from
 * `ctx.teamId` (the `x-team-id` header). When no team header is present the
 * procedure is treated as a cross-organisation query and every organisation
 * the user belongs to is in scope (conservative).
 */
export const TWO_FACTOR_CTX_TEAM = Symbol('TWO_FACTOR_CTX_TEAM');

/**
 * Organisation scope declared as a function of the parsed input. Each key is
 * a resource kind, each value the ID (or IDs) whose owning organisation(s)
 * are in scope for the request.
 *
 * An empty descriptor (`{}`) means "no organisation scope" — the instance
 * assert still applies.
 *
 * The reference kinds (`organisationReference` / `teamReference`) accept an
 * ID or a URL slug and resolve via a membership-qualified OR lookup.
 */
export type TwoFactorScopeDescriptor = {
  organisation?: string | string[];
  organisationReference?: string | string[];
  team?: number | number[];
  teamReference?: string | number | Array<string | number>;
  envelope?: string | string[];
  document?: number | number[];
  template?: number | number[];
  envelopeItem?: string | string[];
  field?: number | number[];
  recipient?: number | number[];
  attachment?: string | string[];
  folder?: string | string[];
  webhook?: string | string[];
  organisationGroup?: string | string[];
  teamGroup?: string | string[];
  organisationEmail?: string | string[];
  organisationEmailDomain?: string | string[];
};

export type TwoFactorScopeResult =
  | TwoFactorScopeDescriptor
  | TwoFactorScopeDescriptor[]
  | typeof TWO_FACTOR_SKIP
  | typeof TWO_FACTOR_CTX_TEAM;

export type NormalizedTwoFactorScope =
  | { type: 'skip' }
  | { type: 'ctxTeam' }
  | { type: 'resources'; resources: TwoFactorEnforcementResourceIds[] };

const toArray = <T>(value: T | T[] | undefined): T[] => {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

/**
 * The bulk cap applied to the already-parsed IDs a resolver returns. Rejects
 * rather than truncates.
 */
const assertBulkCap = (ids: unknown[]): void => {
  if (ids.length > TWO_FACTOR_ENFORCEMENT_MAX_BULK_IDS) {
    throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
      message: 'Too many resource IDs for 2FA enforcement resolution.',
      statusCode: 400,
    });
  }
};

/**
 * Normalizes a resolver result into either a sentinel outcome or the
 * resource-ID sets consumed by the shared organisation resolution machinery.
 *
 * Descriptors are merged per kind so a multi-descriptor result still resolves
 * with a single batch query per resource kind.
 */
export const normalizeTwoFactorScopeResult = (result: TwoFactorScopeResult): NormalizedTwoFactorScope => {
  if (result === TWO_FACTOR_SKIP) {
    return { type: 'skip' };
  }

  if (result === TWO_FACTOR_CTX_TEAM) {
    return { type: 'ctxTeam' };
  }

  const descriptors = Array.isArray(result) ? result : [result];

  const merged: {
    organisation: string[];
    organisationReference: string[];
    team: number[];
    teamReference: Array<string | number>;
    envelope: string[];
    document: number[];
    template: number[];
    envelopeItem: string[];
    field: number[];
    recipient: number[];
    attachment: string[];
    folder: string[];
    webhook: string[];
    organisationGroup: string[];
    teamGroup: string[];
    organisationEmail: string[];
    organisationEmailDomain: string[];
  } = {
    organisation: [],
    organisationReference: [],
    team: [],
    teamReference: [],
    envelope: [],
    document: [],
    template: [],
    envelopeItem: [],
    field: [],
    recipient: [],
    attachment: [],
    folder: [],
    webhook: [],
    organisationGroup: [],
    teamGroup: [],
    organisationEmail: [],
    organisationEmailDomain: [],
  };

  for (const descriptor of descriptors) {
    merged.organisation.push(...toArray(descriptor.organisation));
    merged.organisationReference.push(...toArray(descriptor.organisationReference));
    merged.team.push(...toArray(descriptor.team));
    merged.teamReference.push(...toArray(descriptor.teamReference));
    merged.envelope.push(...toArray(descriptor.envelope));
    merged.document.push(...toArray(descriptor.document));
    merged.template.push(...toArray(descriptor.template));
    merged.envelopeItem.push(...toArray(descriptor.envelopeItem));
    merged.field.push(...toArray(descriptor.field));
    merged.recipient.push(...toArray(descriptor.recipient));
    merged.attachment.push(...toArray(descriptor.attachment));
    merged.folder.push(...toArray(descriptor.folder));
    merged.webhook.push(...toArray(descriptor.webhook));
    merged.organisationGroup.push(...toArray(descriptor.organisationGroup));
    merged.teamGroup.push(...toArray(descriptor.teamGroup));
    merged.organisationEmail.push(...toArray(descriptor.organisationEmail));
    merged.organisationEmailDomain.push(...toArray(descriptor.organisationEmailDomain));
  }

  for (const ids of Object.values(merged)) {
    assertBulkCap(ids);
  }

  const resources: TwoFactorEnforcementResourceIds[] = [];

  if (merged.organisation.length > 0) {
    resources.push({ kind: 'organisation', organisationIds: merged.organisation });
  }

  if (merged.organisationReference.length > 0) {
    resources.push({ kind: 'organisationReference', references: merged.organisationReference });
  }

  if (merged.team.length > 0) {
    resources.push({ kind: 'team', teamIds: merged.team });
  }

  if (merged.teamReference.length > 0) {
    resources.push({ kind: 'teamReference', references: merged.teamReference });
  }

  if (merged.envelope.length > 0) {
    resources.push({ kind: 'envelope', envelopeIds: merged.envelope, documentIds: [], templateIds: [] });
  }

  if (merged.document.length > 0) {
    resources.push({ kind: 'document', documentIds: merged.document });
  }

  if (merged.template.length > 0) {
    resources.push({ kind: 'template', templateIds: merged.template });
  }

  if (merged.envelopeItem.length > 0) {
    resources.push({ kind: 'envelopeItem', envelopeItemIds: merged.envelopeItem });
  }

  if (merged.field.length > 0) {
    resources.push({ kind: 'field', fieldIds: merged.field });
  }

  if (merged.recipient.length > 0) {
    resources.push({ kind: 'recipient', recipientIds: merged.recipient });
  }

  if (merged.attachment.length > 0) {
    resources.push({ kind: 'attachment', attachmentIds: merged.attachment });
  }

  if (merged.folder.length > 0) {
    resources.push({ kind: 'folder', folderIds: merged.folder });
  }

  if (merged.webhook.length > 0) {
    resources.push({ kind: 'webhook', webhookIds: merged.webhook });
  }

  if (merged.organisationGroup.length > 0) {
    resources.push({ kind: 'organisationGroup', groupIds: merged.organisationGroup });
  }

  if (merged.teamGroup.length > 0) {
    resources.push({ kind: 'teamGroup', groupIds: merged.teamGroup });
  }

  if (merged.organisationEmail.length > 0) {
    resources.push({ kind: 'organisationEmail', emailIds: merged.organisationEmail });
  }

  if (merged.organisationEmailDomain.length > 0) {
    resources.push({ kind: 'organisationEmailDomain', emailDomainIds: merged.organisationEmailDomain });
  }

  return { type: 'resources', resources };
};
