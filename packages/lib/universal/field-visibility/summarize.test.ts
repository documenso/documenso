import { describe, expect, it } from 'vitest';

import { summarizeUnmetRules } from './summarize';

describe('summarizeUnmetRules', () => {
  it('single equals rule → label was not "value"', () => {
    const block = {
      match: 'all' as const,
      rules: [
        {
          triggerFieldStableId: 'field-1',
          operator: 'equals' as const,
          value: 'Married',
        },
      ],
    };

    const map = new Map([['field-1', 'Marital Status']]);

    expect(summarizeUnmetRules(block, map)).toBe('Marital Status was not "Married"');
  });

  it('two rules with match=all → joined with " and "', () => {
    const block = {
      match: 'all' as const,
      rules: [
        {
          triggerFieldStableId: 'field-1',
          operator: 'equals' as const,
          value: 'Yes',
        },
        {
          triggerFieldStableId: 'field-2',
          operator: 'notEquals' as const,
          value: 'No',
        },
      ],
    };

    const map = new Map([
      ['field-1', 'Consent'],
      ['field-2', 'Opt Out'],
    ]);

    expect(summarizeUnmetRules(block, map)).toBe('Consent was not "Yes" and Opt Out was "No"');
  });

  it('two rules with match=any → joined with " or "', () => {
    const block = {
      match: 'any' as const,
      rules: [
        {
          triggerFieldStableId: 'field-1',
          operator: 'contains' as const,
          value: 'urgent',
        },
        {
          triggerFieldStableId: 'field-2',
          operator: 'notContains' as const,
          value: 'low',
        },
      ],
    };

    const map = new Map([
      ['field-1', 'Priority'],
      ['field-2', 'Category'],
    ]);

    expect(summarizeUnmetRules(block, map)).toBe(
      'Priority did not contain "urgent" or Category contained "low"',
    );
  });

  it('unknown trigger stableId falls back to "a required field"', () => {
    const block = {
      match: 'all' as const,
      rules: [
        {
          triggerFieldStableId: 'unknown-id',
          operator: 'equals' as const,
          value: 'Active',
        },
      ],
    };

    const map = new Map<string, string>(); // empty map

    expect(summarizeUnmetRules(block, map)).toBe('a required field was not "Active"');
  });

  it('isEmpty operator → "label was not empty"', () => {
    const block = {
      match: 'all' as const,
      rules: [
        {
          triggerFieldStableId: 'field-1',
          operator: 'isEmpty' as const,
        },
      ],
    };

    const map = new Map([['field-1', 'Notes']]);

    expect(summarizeUnmetRules(block, map)).toBe('Notes was not empty');
  });

  it('isNotEmpty operator → "label was empty"', () => {
    const block = {
      match: 'all' as const,
      rules: [
        {
          triggerFieldStableId: 'field-1',
          operator: 'isNotEmpty' as const,
        },
      ],
    };

    const map = new Map([['field-1', 'Signature']]);

    expect(summarizeUnmetRules(block, map)).toBe('Signature was empty');
  });
});
