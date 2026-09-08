import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { describe, expect, it } from 'vitest';

import {
  assertScopeBudget,
  normalizeTwoFactorScopeResult,
  TWO_FACTOR_CTX_TEAM,
  TWO_FACTOR_ENFORCEMENT_MAX_BULK_IDS,
  TWO_FACTOR_ENFORCEMENT_MAX_UNIQUE_SCOPES,
  TWO_FACTOR_SKIP,
} from './scope';

describe('normalizeTwoFactorScopeResult', () => {
  it('maps the sentinels to their outcomes', () => {
    expect(normalizeTwoFactorScopeResult(TWO_FACTOR_SKIP)).toEqual({ type: 'skip' });
    expect(normalizeTwoFactorScopeResult(TWO_FACTOR_CTX_TEAM)).toEqual({ type: 'ctxTeam' });
  });

  it('normalizes an empty descriptor to no resources (instance assert only)', () => {
    expect(normalizeTwoFactorScopeResult({})).toEqual({ type: 'resources', resources: [] });
  });

  it('normalizes single IDs and ID arrays', () => {
    expect(normalizeTwoFactorScopeResult({ envelope: 'envelope_1' })).toEqual({
      type: 'resources',
      resources: [{ kind: 'envelope', envelopeIds: ['envelope_1'], documentIds: [], templateIds: [] }],
    });

    expect(normalizeTwoFactorScopeResult({ envelope: ['a', 'b'] })).toEqual({
      type: 'resources',
      resources: [{ kind: 'envelope', envelopeIds: ['a', 'b'], documentIds: [], templateIds: [] }],
    });
  });

  it('normalizes every resource kind to its resource-IDs variant', () => {
    const result = normalizeTwoFactorScopeResult({
      organisation: 'org_1',
      organisationReference: 'my-org-url',
      team: 1,
      teamReference: 7,
      envelope: 'envelope_1',
      document: 2,
      template: 3,
      envelopeItem: 'item_1',
      field: 4,
      recipient: 5,
      attachment: 'attachment_1',
      folder: 'folder_1',
      webhook: 'webhook_1',
      organisationGroup: 'group_1',
      teamGroup: 'team_group_1',
      organisationEmail: 'email_1',
      organisationEmailDomain: 'domain_1',
    });

    expect(result).toEqual({
      type: 'resources',
      resources: [
        { kind: 'organisation', organisationIds: ['org_1'] },
        { kind: 'organisationReference', references: ['my-org-url'] },
        { kind: 'team', teamIds: [1] },
        { kind: 'teamReference', references: [7] },
        { kind: 'envelope', envelopeIds: ['envelope_1'], documentIds: [], templateIds: [] },
        { kind: 'document', documentIds: [2] },
        { kind: 'template', templateIds: [3] },
        { kind: 'envelopeItem', envelopeItemIds: ['item_1'] },
        { kind: 'field', fieldIds: [4] },
        { kind: 'recipient', recipientIds: [5] },
        { kind: 'attachment', attachmentIds: ['attachment_1'] },
        { kind: 'folder', folderIds: ['folder_1'] },
        { kind: 'webhook', webhookIds: ['webhook_1'] },
        { kind: 'organisationGroup', groupIds: ['group_1'] },
        { kind: 'teamGroup', groupIds: ['team_group_1'] },
        { kind: 'organisationEmail', emailIds: ['email_1'] },
        { kind: 'organisationEmailDomain', emailDomainIds: ['domain_1'] },
      ],
    });
  });

  it('accepts a string-or-number teamReference (URL slug or ID)', () => {
    expect(normalizeTwoFactorScopeResult({ teamReference: ['my-team-url', 7] })).toEqual({
      type: 'resources',
      resources: [{ kind: 'teamReference', references: ['my-team-url', 7] }],
    });
  });

  it('merges descriptor arrays per kind so each kind resolves in one batch', () => {
    expect(normalizeTwoFactorScopeResult([{ envelope: 'a' }, { envelope: ['b'], recipient: 7 }])).toEqual({
      type: 'resources',
      resources: [
        { kind: 'envelope', envelopeIds: ['a', 'b'], documentIds: [], templateIds: [] },
        { kind: 'recipient', recipientIds: [7] },
      ],
    });
  });

  it('accepts ID sets at the bulk cap', () => {
    const ids = Array.from({ length: TWO_FACTOR_ENFORCEMENT_MAX_BULK_IDS }, (_, i) => `envelope_${i}`);

    expect(normalizeTwoFactorScopeResult({ envelope: ids })).toEqual({
      type: 'resources',
      resources: [{ kind: 'envelope', envelopeIds: ids, documentIds: [], templateIds: [] }],
    });
  });

  it('rejects ID sets above the bulk cap instead of truncating', () => {
    const oversized = Array.from({ length: TWO_FACTOR_ENFORCEMENT_MAX_BULK_IDS + 1 }, (_, i) => `envelope_${i}`);

    try {
      normalizeTwoFactorScopeResult({ envelope: oversized });
      expect.unreachable();
    } catch (error) {
      expect(AppError.parseError(error).code).toBe(AppErrorCode.LIMIT_EXCEEDED);
    }
  });

  it('rejects when merged descriptors exceed the bulk cap combined', () => {
    const half = Array.from({ length: TWO_FACTOR_ENFORCEMENT_MAX_BULK_IDS / 2 + 1 }, (_, i) => `envelope_${i}`);

    expect(() => normalizeTwoFactorScopeResult([{ envelope: half }, { envelope: half }])).toThrowError(AppError);
  });
});

describe('assertScopeBudget', () => {
  it('allows counts within the budget', () => {
    expect(() => assertScopeBudget(TWO_FACTOR_ENFORCEMENT_MAX_UNIQUE_SCOPES)).not.toThrow();
  });

  it('rejects counts above the budget', () => {
    try {
      assertScopeBudget(TWO_FACTOR_ENFORCEMENT_MAX_UNIQUE_SCOPES + 1);
      expect.unreachable();
    } catch (error) {
      expect(AppError.parseError(error).code).toBe(AppErrorCode.LIMIT_EXCEEDED);
    }
  });
});
